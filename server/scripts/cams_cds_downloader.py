#!/usr/bin/env python3
"""Download a bounded CAMS aerosol request through cdsapi."""

import argparse
import json
import os
from pathlib import Path


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument("--request-json", required=True)
    parser.add_argument("--output", required=True)
    return parser.parse_args()


def has_credentials():
    if os.environ.get("ADSAPI_URL") and os.environ.get("ADSAPI_KEY"):
        return True
    if os.environ.get("CDSAPI_URL") and os.environ.get("CDSAPI_KEY"):
        return True
    return Path.home().joinpath(".cdsapirc").exists() or Path.home().joinpath(".adsapirc").exists()


def fail(code, message):
    raise SystemExit(f"{code}: {message}")


def normalize_request(request):
    leadtime = request.get("leadtime_hour", request.get("leadtimeHour", []))
    if not isinstance(leadtime, list):
        leadtime = [leadtime]

    payload = {
        "type": request.get("type") or request.get("productType") or "forecast",
        "date": request["date"],
        "time": request["time"],
        "leadtime_hour": [str(int(hour)) for hour in leadtime],
        "variable": request["variable"],
        "format": request.get("format") or "netcdf_zip",
        "area": [float(value) for value in request["area"]],
    }
    return request["dataset"], payload


def make_client():
    try:
        import cdsapi
    except Exception as exc:
        fail("CAMS_CDSAPI_NOT_INSTALLED", f"cdsapi is not installed: {exc}")

    if not has_credentials():
        fail("CAMS_AUTH_NOT_CONFIGURED", "ADS/CDS credentials are not configured")

    url = os.environ.get("ADSAPI_URL") or os.environ.get("CDSAPI_URL")
    key = os.environ.get("ADSAPI_KEY") or os.environ.get("CDSAPI_KEY")
    if url and key:
        return cdsapi.Client(url=url, key=key, quiet=True)
    return cdsapi.Client(quiet=True)


def main():
    args = parse_args()
    with open(args.request_json, "r", encoding="utf-8") as handle:
        request = json.load(handle)

    dataset, payload = normalize_request(request)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    tmp_output = output.with_suffix(output.suffix + ".download")
    if tmp_output.exists():
        tmp_output.unlink()

    client = make_client()
    try:
        client.retrieve(dataset, payload, str(tmp_output))
    except SystemExit:
        raise
    except Exception as exc:
        fail("CAMS_DOWNLOAD_FAILED", str(exc))

    tmp_output.replace(output)
    print(json.dumps({
        "bytesDownloaded": output.stat().st_size,
        "rawPath": str(output),
    }, separators=(",", ":")))


if __name__ == "__main__":
    main()
