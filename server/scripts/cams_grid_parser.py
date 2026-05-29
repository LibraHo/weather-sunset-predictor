#!/usr/bin/env python3
"""Parse CAMS NetCDF/NetCDF zip aerosol grids into Xiake grid records."""

import argparse
import json
import math
import sys
import tempfile
import zipfile
from pathlib import Path

import numpy as np
import xarray as xr


FIELD_ALIASES = {
    "aod550": "total_aerosol_optical_depth_550nm",
    "aod550nm": "total_aerosol_optical_depth_550nm",
    "total_aerosol_optical_depth_550nm": "total_aerosol_optical_depth_550nm",
    "duaod550": "dust_aerosol_optical_depth_550nm",
    "dust_aerosol_optical_depth_550nm": "dust_aerosol_optical_depth_550nm",
    "bcaod550": "black_carbon_aerosol_optical_depth_550nm",
    "black_carbon_aerosol_optical_depth_550nm": "black_carbon_aerosol_optical_depth_550nm",
    "omaod550": "organic_matter_aerosol_optical_depth_550nm",
    "organic_matter_aerosol_optical_depth_550nm": "organic_matter_aerosol_optical_depth_550nm",
    "suaod550": "sulphate_aerosol_optical_depth_550nm",
    "sulphate_aerosol_optical_depth_550nm": "sulphate_aerosol_optical_depth_550nm",
    "pm10": "particulate_matter_10um",
    "particulate_matter_10um": "particulate_matter_10um",
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--north", type=float, required=True)
    parser.add_argument("--south", type=float, required=True)
    parser.add_argument("--west", type=float, required=True)
    parser.add_argument("--east", type=float, required=True)
    parser.add_argument("--resolution", type=float, default=0.5)
    parser.add_argument("--max-points", type=int, default=250000)
    return parser.parse_args()


def coord_name(dataset, candidates):
    for name in candidates:
        if name in dataset.coords:
            return name
    return None


def normalize_lon(value):
    lon = float(value)
    return lon - 360.0 if lon > 180.0 else lon


def aligned_to_global_grid(value, step):
    if step <= 0:
        return True
    ratio = value / step
    return abs(ratio - round(ratio)) < 1e-4


def in_bbox(lat, lon, args):
    return args.south - 1e-6 <= lat <= args.north + 1e-6 and args.west - 1e-6 <= lon <= args.east + 1e-6


def forecast_hour_from_array(data_array):
    for dim in data_array.dims:
        if dim in ("step", "leadtime", "leadtime_hour", "forecast_hour"):
            value = data_array.coords[dim].values[0]
            try:
                return int(round(float(value) / 3600000000000.0))
            except Exception:
                try:
                    return int(round(float(value)))
                except Exception:
                    return 0
    return 0


def squeeze_to_lat_lon(data_array, lat_name, lon_name):
    selectors = {}
    for dim in data_array.dims:
        if dim not in (lat_name, lon_name):
            selectors[dim] = 0
    if selectors:
        data_array = data_array.isel(**selectors)
    return data_array


def put_value(records, lat, lon, forecast_hour, field, value):
    try:
        number = float(value)
    except Exception:
        return
    if not math.isfinite(number):
        return
    key = f"{forecast_hour}:{lat:.4f},{lon:.4f}"
    record = records.setdefault(key, {
        "lat": round(lat, 4),
        "lon": round(lon, 4),
        "forecastHour": forecast_hour,
        "values": {},
    })
    record["values"].setdefault(field, number)


def ingest_variable(records, data_array, field, args):
    lat_name = coord_name(data_array, ["latitude", "lat"])
    lon_name = coord_name(data_array, ["longitude", "lon"])
    if not lat_name or not lon_name:
        return 0

    forecast_hour = forecast_hour_from_array(data_array)
    data_array = squeeze_to_lat_lon(data_array, lat_name, lon_name)
    latitudes = np.asarray(data_array[lat_name].values)
    longitudes = np.asarray(data_array[lon_name].values)
    values = np.asarray(data_array.values)

    count = 0
    if latitudes.ndim == 1 and longitudes.ndim == 1:
        for row, raw_lat in enumerate(latitudes):
            lat = float(raw_lat)
            if not aligned_to_global_grid(lat, args.resolution):
                continue
            for col, raw_lon in enumerate(longitudes):
                lon = normalize_lon(raw_lon)
                if not aligned_to_global_grid(lon, args.resolution) or not in_bbox(lat, lon, args):
                    continue
                put_value(records, lat, lon, forecast_hour, field, values[row, col])
                count += 1
        return count

    if latitudes.shape == values.shape and longitudes.shape == values.shape:
        for index, value in np.ndenumerate(values):
            lat = float(latitudes[index])
            lon = normalize_lon(longitudes[index])
            if not aligned_to_global_grid(lat, args.resolution) or not aligned_to_global_grid(lon, args.resolution):
                continue
            if not in_bbox(lat, lon, args):
                continue
            put_value(records, lat, lon, forecast_hour, field, value)
            count += 1
    return count


def open_datasets(input_path):
    path = Path(input_path)
    if zipfile.is_zipfile(path):
        tempdir = tempfile.TemporaryDirectory()
        with zipfile.ZipFile(path) as archive:
            members = [name for name in archive.namelist() if name.endswith((".nc", ".netcdf"))]
            if not members:
                raise RuntimeError("CAMS zip contains no NetCDF files")
            archive.extractall(tempdir.name, members)
        datasets = [xr.open_dataset(str(Path(tempdir.name) / name)) for name in members]
        return datasets, tempdir
    return [xr.open_dataset(str(path))], None


def main():
    args = parse_args()
    datasets, tempdir = open_datasets(args.input)
    records = {}
    fields = set()

    try:
        for dataset in datasets:
            for var_name in dataset.data_vars:
                field = FIELD_ALIASES.get(var_name) or FIELD_ALIASES.get(var_name.lower())
                if not field:
                    continue
                count = ingest_variable(records, dataset[var_name], field, args)
                if count > 0:
                    fields.add(field)
    finally:
        for dataset in datasets:
            try:
                dataset.close()
            except Exception:
                pass
        if tempdir:
            tempdir.cleanup()

    out = list(records.values())
    if len(out) > args.max_points:
        raise RuntimeError(f"parsed point count {len(out)} exceeds max-points {args.max_points}")
    if not out:
        raise RuntimeError("no CAMS records parsed from NetCDF subset")

    out.sort(key=lambda item: (item["forecastHour"], item["lat"], item["lon"]))
    print(json.dumps({
        "records": out,
        "meta": {
            "recordCount": len(out),
            "fields": sorted(fields),
            "datasetCount": len(datasets),
        },
    }, separators=(",", ":")))


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"CAMS_NETCDF_PARSER_FAILED: {exc}", file=sys.stderr)
        raise
