#!/usr/bin/env python3
"""Parse a NOAA GFS GRIB2 subset into Xiake grid records.

The Node data pipeline downloads a bounded GRIB2 file from NOMADS. This script
keeps parsing isolated in Python/cfgrib and emits compact JSON for Node.
"""

import argparse
import json
import math
import sys

import numpy as np
import xarray as xr

try:
    import cfgrib
except Exception:  # pragma: no cover - surfaced as a runtime error
    cfgrib = None


FIELD_ALIASES = {
    "tcc": "TCDC",
    "avg_tcc": "TCDC",
    "lcc": "LCDC",
    "avg_lcc": "LCDC",
    "mcc": "MCDC",
    "avg_mcc": "MCDC",
    "hcc": "HCDC",
    "avg_hcc": "HCDC",
    "r": "RH",
    "r2": "RH",
    "2r": "RH",
    "vis": "VIS",
    "tp": "APCP",
    "prate": "PRATE",
    "pwat": "PWAT",
    "dswrf": "DSWRF",
    "sdswrf": "DSWRF",
    "t": "TMP",
    "t2m": "TMP",
    "2t": "TMP",
    "u": "UGRD",
    "u10": "UGRD",
    "10u": "UGRD",
    "v": "VGRD",
    "v10": "VGRD",
    "10v": "VGRD",
    "TCDC": "TCDC",
    "LCDC": "LCDC",
    "MCDC": "MCDC",
    "HCDC": "HCDC",
    "RH": "RH",
    "VIS": "VIS",
    "APCP": "APCP",
    "PRATE": "PRATE",
    "PWAT": "PWAT",
    "DSWRF": "DSWRF",
    "TMP": "TMP",
    "UGRD": "UGRD",
    "VGRD": "VGRD",
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


def open_grib_datasets(path):
    backend_kwargs = {"indexpath": ""}
    if cfgrib is not None:
        try:
            datasets = cfgrib.open_datasets(path, backend_kwargs=backend_kwargs)
            if datasets:
                return datasets
        except Exception as exc:
            print(f"[gfs_grid_parser] cfgrib.open_datasets failed: {exc}", file=sys.stderr)

    return [xr.open_dataset(path, engine="cfgrib", backend_kwargs=backend_kwargs)]


def coord_name(dataset, candidates):
    for name in candidates:
        if name in dataset.coords:
            return name
    return None


def normalize_lon(value):
    lon = float(value)
    return lon - 360.0 if lon > 180.0 else lon


def squeeze_to_lat_lon(data_array, lat_name, lon_name):
    selectors = {}
    for dim in data_array.dims:
        if dim not in (lat_name, lon_name):
            selectors[dim] = 0
    if selectors:
        data_array = data_array.isel(**selectors)
    return data_array


def aligned_to_global_grid(value, step):
    if step <= 0:
        return True
    # The bbox can be arbitrary (for example 39.1..40.1). Downsample from the
    # source coordinate grid instead of requiring bbox edges to align.
    ratio = value / step
    return abs(ratio - round(ratio)) < 1e-4


def in_bbox(lat, lon, args):
    return args.south - 1e-6 <= lat <= args.north + 1e-6 and args.west - 1e-6 <= lon <= args.east + 1e-6


def put_value(records, lat, lon, field, value):
    if value is None:
        return
    try:
        number = float(value)
    except Exception:
        return
    if not math.isfinite(number):
        return
    key = f"{lat:.4f},{lon:.4f}"
    record = records.setdefault(key, {"lat": round(lat, 4), "lon": round(lon, 4), "values": {}})
    record["values"].setdefault(field, number)


def ingest_variable(records, data_array, field, args):
    lat_name = coord_name(data_array, ["latitude", "lat"])
    lon_name = coord_name(data_array, ["longitude", "lon"])
    if not lat_name or not lon_name:
        return 0

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
                put_value(records, lat, lon, field, values[row, col])
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
            put_value(records, lat, lon, field, value)
            count += 1
    return count


def main():
    args = parse_args()
    datasets = open_grib_datasets(args.input)
    records = {}
    fields = set()

    for dataset in datasets:
        for var_name in dataset.data_vars:
            field = FIELD_ALIASES.get(var_name) or FIELD_ALIASES.get(var_name.upper())
            if not field:
                continue
            count = ingest_variable(records, dataset[var_name], field, args)
            if count > 0:
                fields.add(field)

    out = list(records.values())
    if len(out) > args.max_points:
        raise RuntimeError(f"parsed point count {len(out)} exceeds max-points {args.max_points}")
    if not out:
        raise RuntimeError("no GFS records parsed from GRIB2 subset")

    out.sort(key=lambda item: (item["lat"], item["lon"]))
    print(json.dumps({
        "records": out,
        "meta": {
            "recordCount": len(out),
            "fields": sorted(fields),
            "datasetCount": len(datasets),
        },
    }, separators=(",", ":")))


if __name__ == "__main__":
    main()
