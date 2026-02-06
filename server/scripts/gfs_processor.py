#!/usr/bin/env python3
"""
GFS数据处理服务 - 火烧云地图覆盖层生成器

功能：
1. 从NOAA下载GFS GRIB2数据（支持0.25°和0.5°分辨率）
2. 解析气象变量（云量分层数据）
3. 应用"光路追踪+云量评分"算法
4. 生成RGBA PNG覆盖层
5. 输出JSON元数据到stdout

使用方法：
    python gfs_processor.py --lat 39.9042 --lon 116.4074 --radius 200 --type sunset

输出格式（JSON）：
    {
        "image_path": "/tmp/firecloud_overlay_XXXX.png",
        "bounds": {
            "north": 40.0,
            "south": 39.0,
            "east": 117.0,
            "west": 116.0
        },
        "timestamp": 1640000000000,
        "gfs_run": "2024-01-15T12:00:00Z"
    }

需求：22 (Phase 6 - 火烧云地图重构)
"""

import argparse
import json
import os
import sys
import tempfile
from datetime import datetime, timezone, timedelta
from pathlib import Path

import numpy as np
import requests
from PIL import Image
import xarray as xr


class GFSDataProcessor:
    """GFS数据处理类"""

    # NOAA GFS数据源URL（支持多种分辨率）
    # 0.25度分辨率（约25km）
    GFS_BASE_URL_025 = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod"
    # 0.5度分辨率（约50km，文件更小）
    GFS_BASE_URL_050 = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod"

    # NOAA NOMADS OPeNDAP 服务（支持子集下载）
    GFS_OPENDAP_URL = "https://nomads.ncep.noaa.gov/dods/gfs_0p25"

    # GFS运行时间（UTC）- GFS每6小时运行一次
    GFS_RUN_HOURS = [0, 6, 12, 18]

    # 云量变量映射（不同GRIB2文件可能使用不同名称）
    CLOUD_VAR_MAPPINGS = {
        # cfgrib 标准名称
        'lcc': 'low_cloud_cover',      # 低云量
        'mcc': 'medium_cloud_cover',    # 中云量
        'hcc': 'high_cloud_cover',      # 高云量
        'tcc': 'total_cloud_cover',     # 总云量
        # GFS GRIB2 原始名称
        'LCDC': 'low_cloud_cover',
        'MCDC': 'medium_cloud_cover',
        'HCDC': 'high_cloud_cover',
        'TCDC': 'total_cloud_cover',
    }

    def __init__(self, lat, lon, radius_km=200, prediction_type='sunset', resolution='0p25'):
        """
        初始化GFS数据处理器

        Args:
            lat: 中心纬度
            lon: 中心经度
            radius_km: 半径（公里）
            prediction_type: 预测类型（sunrise/sunset）
            resolution: GFS分辨率 ('0p25' 或 '0p50')
        """
        self.lat = lat
        self.lon = lon
        self.radius_km = radius_km
        self.prediction_type = prediction_type
        self.resolution = resolution
        self.gfs_run_time = None  # 记录使用的GFS运行时间

        # 计算数据边界
        # 0.25°分辨率约25km，0.50°分辨率约50km
        grid_size_km = 25 if resolution == '0p25' else 50

        # 增加额外边界以确保覆盖（光路追踪需要向西/东延伸）
        extra_km = 300 if prediction_type == 'sunset' else 300  # 向日落/日出方向延伸

        self.delta_lat = (radius_km + 50) / 111  # 纬度1度约111km
        self.delta_lon = (radius_km + extra_km) / (111 * np.cos(np.radians(lat)))

        self.bounds = {
            'north': min(90, lat + self.delta_lat),
            'south': max(-90, lat - self.delta_lat),
            'east': min(180, lon + self.delta_lon),
            'west': max(-180, lon - self.delta_lon)
        }

        # 输出边界（用于显示，不含光路追踪扩展）
        display_delta_lon = radius_km / (111 * np.cos(np.radians(lat)))
        self.display_bounds = {
            'north': min(90, lat + self.delta_lat),
            'south': max(-90, lat - self.delta_lat),
            'east': min(180, lon + display_delta_lon),
            'west': max(-180, lon - display_delta_lon)
        }

    def _get_latest_gfs_run(self):
        """
        获取最近可用的GFS运行时间

        GFS每6小时运行一次（00, 06, 12, 18 UTC）
        数据通常在运行后3-4小时可用

        Returns:
            datetime: 最近可用的GFS运行时间
        """
        now = datetime.now(timezone.utc)

        # 找到最近的运行时间
        for hours_back in range(0, 24, 6):
            check_time = now - timedelta(hours=hours_back)
            run_hour = max([h for h in self.GFS_RUN_HOURS if h <= check_time.hour], default=18)

            # 如果当前小时小于最小运行小时，使用前一天的18点
            if check_time.hour < min(self.GFS_RUN_HOURS):
                check_time = check_time - timedelta(days=1)
                run_hour = 18

            run_time = check_time.replace(hour=run_hour, minute=0, second=0, microsecond=0)

            # 检查数据是否可能可用（至少等待3小时）
            if (now - run_time).total_seconds() >= 3 * 3600:
                return run_time

        # 回退到24小时前的运行
        fallback = now - timedelta(hours=24)
        run_hour = max([h for h in self.GFS_RUN_HOURS if h <= fallback.hour], default=18)
        return fallback.replace(hour=run_hour, minute=0, second=0, microsecond=0)

    def _build_gfs_url(self, run_time, forecast_hour=0):
        """
        构建GFS数据下载URL

        Args:
            run_time: GFS运行时间
            forecast_hour: 预报小时数（0=分析场）

        Returns:
            str: GFS数据URL
        """
        date_str = run_time.strftime('%Y%m%d')
        hour_str = f"{run_time.hour:02d}"
        forecast_str = f"f{forecast_hour:03d}"

        # 构建URL（0.25度分辨率）
        if self.resolution == '0p25':
            url = (f"{self.GFS_BASE_URL_025}/gfs.{date_str}/{hour_str}/atmos/"
                   f"gfs.t{hour_str}z.pgrb2.0p25.{forecast_str}")
        else:
            url = (f"{self.GFS_BASE_URL_050}/gfs.{date_str}/{hour_str}/atmos/"
                   f"gfs.t{hour_str}z.pgrb2.0p50.{forecast_str}")

        return url

    def download_gfs_data(self):
        """
        下载GFS GRIB2数据

        Returns:
            str: 下载的GRIB2文件路径
        """
        print(f"[GFS Processor] 下载GFS数据: {self.lat}, {self.lon}, 半径: {self.radius_km}km", file=sys.stderr)

        # 获取最近可用的GFS运行时间
        self.gfs_run_time = self._get_latest_gfs_run()
        print(f"[GFS Processor] 使用GFS运行时间: {self.gfs_run_time.isoformat()}", file=sys.stderr)

        # 尝试多个运行时间（如果最近的不可用）
        attempts = []
        for hours_back in [0, 6, 12, 18, 24]:
            run_time = self.gfs_run_time - timedelta(hours=hours_back)
            # 对齐到有效的GFS运行时间
            run_hour = max([h for h in self.GFS_RUN_HOURS if h <= run_time.hour], default=0)
            if run_time.hour < min(self.GFS_RUN_HOURS):
                run_time = run_time - timedelta(days=1)
                run_hour = 18
            run_time = run_time.replace(hour=run_hour, minute=0, second=0, microsecond=0)
            if run_time not in attempts:
                attempts.append(run_time)

        last_error = None
        for run_time in attempts:
            url = self._build_gfs_url(run_time, forecast_hour=0)
            print(f"[GFS Processor] 尝试下载: {url}", file=sys.stderr)

            try:
                # 下载数据（流式传输，增加超时）
                response = requests.get(url, stream=True, timeout=120, headers={
                    'User-Agent': 'WeatherSunsetPredictor/1.0 (GFS Data Processor)'
                })
                response.raise_for_status()

                # 保存到临时文件
                temp_file = tempfile.NamedTemporaryFile(suffix='.grib2', delete=False)
                total_size = 0
                for chunk in response.iter_content(chunk_size=8192):
                    temp_file.write(chunk)
                    total_size += len(chunk)
                temp_file.close()

                self.gfs_run_time = run_time
                print(f"[GFS Processor] 下载完成: {temp_file.name} ({total_size / 1024 / 1024:.1f}MB)", file=sys.stderr)
                return temp_file.name

            except requests.RequestException as e:
                last_error = e
                print(f"[GFS Processor] 下载失败 ({run_time.isoformat()}): {e}", file=sys.stderr)
                continue

        raise Exception(f"无法下载GFS数据，尝试了{len(attempts)}个运行时间: {last_error}")

    def parse_grib2(self, grib2_file):
        """
        解析GRIB2文件

        Args:
            grib2_file: GRIB2文件路径

        Returns:
            dict: 包含云量数据的字典 {'low': array, 'mid': array, 'high': array, 'total': array}
        """
        print(f"[GFS Processor] 解析GRIB2文件: {grib2_file}", file=sys.stderr)

        cloud_data = {
            'low': None,
            'mid': None,
            'high': None,
            'total': None,
            'lats': None,
            'lons': None
        }

        try:
            # GFS GRIB2文件包含多种类型的消息，需要分别读取
            # 使用filter_by_keys来选择特定变量

            # 尝试读取云量数据（可能在不同的GRIB消息中）
            datasets_to_try = []

            # 尝试不同的读取方式
            try:
                # 尝试读取低云（low cloud cover）
                ds_low = xr.open_dataset(grib2_file, engine='cfgrib',
                    backend_kwargs={'filter_by_keys': {'typeOfLevel': 'lowCloudLayer'}})
                datasets_to_try.append(('low', ds_low))
            except Exception as e:
                print(f"[GFS Processor] 读取低云数据失败: {e}", file=sys.stderr)

            try:
                # 尝试读取中云（middle cloud cover）
                ds_mid = xr.open_dataset(grib2_file, engine='cfgrib',
                    backend_kwargs={'filter_by_keys': {'typeOfLevel': 'middleCloudLayer'}})
                datasets_to_try.append(('mid', ds_mid))
            except Exception as e:
                print(f"[GFS Processor] 读取中云数据失败: {e}", file=sys.stderr)

            try:
                # 尝试读取高云（high cloud cover）
                ds_high = xr.open_dataset(grib2_file, engine='cfgrib',
                    backend_kwargs={'filter_by_keys': {'typeOfLevel': 'highCloudLayer'}})
                datasets_to_try.append(('high', ds_high))
            except Exception as e:
                print(f"[GFS Processor] 读取高云数据失败: {e}", file=sys.stderr)

            try:
                # 尝试读取总云（total cloud cover）
                ds_total = xr.open_dataset(grib2_file, engine='cfgrib',
                    backend_kwargs={'filter_by_keys': {'typeOfLevel': 'atmosphere'}})
                datasets_to_try.append(('total', ds_total))
            except Exception as e:
                print(f"[GFS Processor] 读取总云数据失败: {e}", file=sys.stderr)

            # 如果上述方法都失败，尝试通用读取
            if not datasets_to_try:
                print("[GFS Processor] 尝试通用读取方式...", file=sys.stderr)
                ds = xr.open_dataset(grib2_file, engine='cfgrib')
                print(f"[GFS Processor] 可用变量: {list(ds.data_vars.keys())}", file=sys.stderr)
                datasets_to_try.append(('generic', ds))

            # 处理读取到的数据
            for level_type, ds in datasets_to_try:
                print(f"[GFS Processor] 处理 {level_type} 数据，变量: {list(ds.data_vars.keys())}", file=sys.stderr)

                # 获取坐标
                if cloud_data['lats'] is None:
                    if 'latitude' in ds.coords:
                        cloud_data['lats'] = ds['latitude'].values
                        cloud_data['lons'] = ds['longitude'].values
                    elif 'lat' in ds.coords:
                        cloud_data['lats'] = ds['lat'].values
                        cloud_data['lons'] = ds['lon'].values

                # 查找云量变量
                for var_name in ds.data_vars:
                    var_lower = var_name.lower()
                    data = ds[var_name].values

                    # 确保数据是2D的
                    while len(data.shape) > 2:
                        data = data[0]

                    if level_type == 'low' or 'lcc' in var_lower or 'low' in var_lower:
                        if cloud_data['low'] is None:
                            cloud_data['low'] = data
                            print(f"[GFS Processor] 低云: shape={data.shape}, range=[{data.min():.1f}, {data.max():.1f}]", file=sys.stderr)
                    elif level_type == 'mid' or 'mcc' in var_lower or 'mid' in var_lower:
                        if cloud_data['mid'] is None:
                            cloud_data['mid'] = data
                            print(f"[GFS Processor] 中云: shape={data.shape}, range=[{data.min():.1f}, {data.max():.1f}]", file=sys.stderr)
                    elif level_type == 'high' or 'hcc' in var_lower or 'high' in var_lower:
                        if cloud_data['high'] is None:
                            cloud_data['high'] = data
                            print(f"[GFS Processor] 高云: shape={data.shape}, range=[{data.min():.1f}, {data.max():.1f}]", file=sys.stderr)
                    elif level_type == 'total' or 'tcc' in var_lower or 'total' in var_lower:
                        if cloud_data['total'] is None:
                            cloud_data['total'] = data
                            print(f"[GFS Processor] 总云: shape={data.shape}, range=[{data.min():.1f}, {data.max():.1f}]", file=sys.stderr)

            # 验证是否获取到了必要的数据
            if cloud_data['lats'] is None:
                raise Exception("无法获取坐标数据")

            # 如果缺少某些云层数据，使用总云量或其他云层估算
            if cloud_data['low'] is None and cloud_data['total'] is not None:
                cloud_data['low'] = cloud_data['total'] * 0.3
                print("[GFS Processor] 使用总云量估算低云", file=sys.stderr)
            if cloud_data['mid'] is None and cloud_data['total'] is not None:
                cloud_data['mid'] = cloud_data['total'] * 0.4
                print("[GFS Processor] 使用总云量估算中云", file=sys.stderr)
            if cloud_data['high'] is None and cloud_data['total'] is not None:
                cloud_data['high'] = cloud_data['total'] * 0.3
                print("[GFS Processor] 使用总云量估算高云", file=sys.stderr)

            # 如果仍然缺少数据，创建默认值
            if cloud_data['low'] is None:
                shape = (721, 1440) if self.resolution == '0p25' else (361, 720)
                cloud_data['low'] = np.zeros(shape, dtype=np.float32)
                print("[GFS Processor] 警告：无低云数据，使用零值", file=sys.stderr)
            if cloud_data['mid'] is None:
                cloud_data['mid'] = np.zeros_like(cloud_data['low'])
                print("[GFS Processor] 警告：无中云数据，使用零值", file=sys.stderr)
            if cloud_data['high'] is None:
                cloud_data['high'] = np.zeros_like(cloud_data['low'])
                print("[GFS Processor] 警告：无高云数据，使用零值", file=sys.stderr)

            return cloud_data

        except Exception as e:
            print(f"[GFS Processor] 解析失败: {e}", file=sys.stderr)
            raise Exception(f"无法解析GRIB2文件: {e}")

    def _subset_to_region(self, cloud_data):
        """
        裁剪数据到目标区域

        Args:
            cloud_data: 包含云量数据的字典

        Returns:
            dict: 裁剪后的云量数据
        """
        lats = cloud_data['lats']
        lons = cloud_data['lons']

        # 处理经度（可能是0-360或-180-180格式）
        if lons.max() > 180:
            # 转换为-180到180格式
            lons = np.where(lons > 180, lons - 360, lons)

        # 找到目标区域的索引
        lat_mask = (lats >= self.bounds['south']) & (lats <= self.bounds['north'])
        lon_mask = (lons >= self.bounds['west']) & (lons <= self.bounds['east'])

        # 获取索引范围
        lat_indices = np.where(lat_mask)[0]
        lon_indices = np.where(lon_mask)[0]

        if len(lat_indices) == 0 or len(lon_indices) == 0:
            print("[GFS Processor] 警告：无法找到目标区域，使用全部数据", file=sys.stderr)
            return cloud_data

        lat_start, lat_end = lat_indices.min(), lat_indices.max() + 1
        lon_start, lon_end = lon_indices.min(), lon_indices.max() + 1

        # 裁剪数据
        subset = {
            'low': cloud_data['low'][lat_start:lat_end, lon_start:lon_end],
            'mid': cloud_data['mid'][lat_start:lat_end, lon_start:lon_end],
            'high': cloud_data['high'][lat_start:lat_end, lon_start:lon_end],
            'lats': lats[lat_start:lat_end],
            'lons': lons[lon_start:lon_end]
        }

        print(f"[GFS Processor] 数据裁剪: {cloud_data['low'].shape} -> {subset['low'].shape}", file=sys.stderr)
        return subset

    def calculate_firecloud_probability(self, cloud_data):
        """
        计算火烧云概率（光路追踪+云量评分算法）

        算法原理：
        1. 光路追踪：检查太阳光到达观测点路径上的低云阻挡
        2. 画布评分：中高云提供散射介质，产生火烧云效果
        3. 低云惩罚：低云会遮挡下方的火烧云

        Args:
            cloud_data: 包含云量数据的字典 {'low', 'mid', 'high', 'lats', 'lons'}

        Returns:
            np.ndarray: 概率矩阵（0-1范围）
        """
        print(f"[GFS Processor] 计算火烧云概率...", file=sys.stderr)

        try:
            # 提取云量数据
            lcdc = cloud_data['low']   # 低云量 (0-100)
            mcdc = cloud_data['mid']   # 中云量 (0-100)
            hcdc = cloud_data['high']  # 高云量 (0-100)

            # 确保数据是2D的
            while len(lcdc.shape) > 2:
                lcdc = lcdc[0]
            while len(mcdc.shape) > 2:
                mcdc = mcdc[0]
            while len(hcdc.shape) > 2:
                hcdc = hcdc[0]

            height, width = lcdc.shape
            print(f"[GFS Processor] 数据维度: {height}x{width}", file=sys.stderr)
            print(f"[GFS Processor] 低云范围: [{lcdc.min():.1f}, {lcdc.max():.1f}]", file=sys.stderr)
            print(f"[GFS Processor] 中云范围: [{mcdc.min():.1f}, {mcdc.max():.1f}]", file=sys.stderr)
            print(f"[GFS Processor] 高云范围: [{hcdc.min():.1f}, {hcdc.max():.1f}]", file=sys.stderr)

            # 初始化概率矩阵
            probability = np.zeros((height, width), dtype=np.float32)

            # 光路追踪算法（向量化以提高性能）
            # 光路检查距离（网格点数）- 0.25度分辨率约25km/格，检查300km约12个格点
            light_path_grids = 12

            # 方向：日落时太阳在西边，光从西边来（GFS数据经度递增）
            direction = 1 if self.prediction_type == 'sunset' else -1

            for i in range(height):
                for j in range(width):
                    # 收集光路上的低云值
                    blocking_sum = 0.0
                    valid_points = 0

                    for k in range(1, light_path_grids + 1):
                        check_j = j + direction * k
                        if 0 <= check_j < width:
                            blocking_sum += lcdc[i, check_j]
                            valid_points += 1

                    # 计算平均低云阻挡（0-100）
                    avg_blocking = blocking_sum / valid_points if valid_points > 0 else 0

                    # 本地低云惩罚
                    local_low_cloud = lcdc[i, j]

                    # 本地中高云画布评分（高斯分布，峰值在50%）
                    mid_cloud = mcdc[i, j]
                    high_cloud = hcdc[i, j]

                    canvas_score = self._gaussian_score(mid_cloud, optimal=50, sigma=30)
                    canvas_score += self._gaussian_score(high_cloud, optimal=40, sigma=25) * 0.8

                    # 光路通畅评分
                    light_path_score = max(0, 1 - avg_blocking / 70)

                    # 本地低云惩罚
                    local_penalty = max(0, 1 - local_low_cloud / 50)

                    # 综合评分
                    final_score = canvas_score * light_path_score * local_penalty
                    probability[i, j] = np.clip(final_score / 2.0, 0, 1)

            print(f"[GFS Processor] 概率矩阵 shape: {probability.shape}", file=sys.stderr)
            print(f"[GFS Processor] 概率范围: [{probability.min():.3f}, {probability.max():.3f}]", file=sys.stderr)
            print(f"[GFS Processor] 概率分布: <0.3: {(probability < 0.3).sum()}, 0.3-0.7: {((probability >= 0.3) & (probability < 0.7)).sum()}, >0.7: {(probability >= 0.7).sum()}", file=sys.stderr)

            return probability

        except Exception as e:
            print(f"[GFS Processor] 概率计算失败: {e}", file=sys.stderr)
            raise Exception(f"无法计算火烧云概率: {e}")

    def _gaussian_score(self, value, optimal=50, sigma=25):
        """
        高斯评分函数

        Args:
            value: 输入值
            optimal: 最优值（高斯峰值位置）
            sigma: 标准差（控制评分衰减速度）

        Returns:
            float: 评分（0-1范围）
        """
        return np.exp(-((value - optimal) ** 2) / (2 * sigma ** 2))

    def generate_overlay_png(self, probability_matrix):
        """
        生成RGBA PNG覆盖层

        颜色映射：
        - 0-20%: 透明/浅灰（低概率）
        - 20-40%: 浅黄色（一般）
        - 40-60%: 金黄色（良好）
        - 60-80%: 橙色（优秀）
        - 80-100%: 红橙色（极佳）

        Args:
            probability_matrix: 概率矩阵（0-1范围）

        Returns:
            str: 生成的PNG文件路径
        """
        print(f"[GFS Processor] 生成PNG覆盖层...", file=sys.stderr)

        try:
            height, width = probability_matrix.shape

            # 创建RGBA图像数组（向量化操作以提高性能）
            img_array = np.zeros((height, width, 4), dtype=np.uint8)

            # 定义颜色映射阈值和对应颜色
            # 格式: (阈值下限, 阈值上限, R, G, B, alpha_min, alpha_max)
            color_ranges = [
                (0.0, 0.2, 180, 180, 180, 0, 60),       # 透明到浅灰
                (0.2, 0.4, 255, 255, 150, 80, 140),     # 浅黄
                (0.4, 0.6, 255, 220, 50, 140, 180),     # 金黄
                (0.6, 0.8, 255, 140, 0, 180, 220),      # 橙色
                (0.8, 1.0, 255, 60, 0, 220, 255),       # 红橙
            ]

            for low, high, r, g, b, alpha_min, alpha_max in color_ranges:
                mask = (probability_matrix >= low) & (probability_matrix < high)
                if mask.any():
                    # 在范围内线性插值alpha
                    normalized = (probability_matrix[mask] - low) / (high - low)
                    alpha = (alpha_min + normalized * (alpha_max - alpha_min)).astype(np.uint8)

                    img_array[mask, 0] = r
                    img_array[mask, 1] = g
                    img_array[mask, 2] = b
                    img_array[mask, 3] = alpha

            # 处理边界情况（概率=1.0）
            mask_max = probability_matrix >= 1.0
            if mask_max.any():
                img_array[mask_max] = [255, 60, 0, 255]

            # 生成PNG图像
            img = Image.fromarray(img_array, mode='RGBA')

            # 使用唯一文件名
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            temp_file = tempfile.NamedTemporaryFile(
                prefix=f'firecloud_{timestamp}_',
                suffix='.png',
                delete=False
            )
            img.save(temp_file.name, 'PNG', optimize=True)
            temp_file.close()

            print(f"[GFS Processor] PNG生成完成: {temp_file.name} ({width}x{height})", file=sys.stderr)

            return temp_file.name

        except Exception as e:
            print(f"[GFS Processor] PNG生成失败: {e}", file=sys.stderr)
            raise Exception(f"无法生成PNG覆盖层: {e}")

    def process(self):
        """
        完整处理流程

        Returns:
            dict: 包含image_path, bounds, timestamp, gfs_run的字典
        """
        timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)
        grib2_file = None

        try:
            # 1. 下载GFS数据
            print("[GFS Processor] 步骤1: 下载GFS数据...", file=sys.stderr)
            grib2_file = self.download_gfs_data()

            # 2. 解析GRIB2
            print("[GFS Processor] 步骤2: 解析GRIB2文件...", file=sys.stderr)
            cloud_data = self.parse_grib2(grib2_file)

            # 3. 裁剪到目标区域
            print("[GFS Processor] 步骤3: 裁剪到目标区域...", file=sys.stderr)
            subset_data = self._subset_to_region(cloud_data)

            # 4. 计算火烧云概率
            print("[GFS Processor] 步骤4: 计算火烧云概率...", file=sys.stderr)
            probability = self.calculate_firecloud_probability(subset_data)

            # 5. 生成PNG覆盖层
            print("[GFS Processor] 步骤5: 生成PNG覆盖层...", file=sys.stderr)
            image_path = self.generate_overlay_png(probability)

            # 6. 清理临时GRIB2文件
            if grib2_file:
                try:
                    os.unlink(grib2_file)
                    print(f"[GFS Processor] 清理临时文件: {grib2_file}", file=sys.stderr)
                except Exception as e:
                    print(f"[GFS Processor] 清理临时文件失败: {e}", file=sys.stderr)

            # 7. 返回结果（使用显示边界，不含光路追踪扩展区域）
            result = {
                'image_path': image_path,
                'bounds': self.display_bounds,
                'timestamp': timestamp,
                'gfs_run': self.gfs_run_time.isoformat() if self.gfs_run_time else None,
                'resolution': self.resolution,
                'prediction_type': self.prediction_type
            }

            print(f"[GFS Processor] 处理完成", file=sys.stderr)
            return result

        except Exception as e:
            # 清理临时文件
            if grib2_file:
                try:
                    os.unlink(grib2_file)
                except:
                    pass
            print(f"[GFS Processor] 处理失败: {e}", file=sys.stderr)
            raise


def main():
    """
    主函数 - GFS火烧云覆盖层处理

    使用方法:
        python gfs_processor.py --lat 39.9042 --lon 116.4074 --radius 200 --type sunset

    输出:
        成功时输出JSON到stdout
        日志和错误输出到stderr
    """
    parser = argparse.ArgumentParser(
        description='GFS数据处理服务 - 火烧云地图覆盖层生成器',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  # 北京日落火烧云预测
  python gfs_processor.py --lat 39.9042 --lon 116.4074 --radius 200 --type sunset

  # 上海日出火烧云预测（较小范围，更快）
  python gfs_processor.py --lat 31.2304 --lon 121.4737 --radius 100 --type sunrise

输出格式（JSON）:
  {
    "image_path": "/tmp/firecloud_20240115_120000_xxx.png",
    "bounds": {"north": 40.0, "south": 39.0, "east": 117.0, "west": 116.0},
    "timestamp": 1705315200000,
    "gfs_run": "2024-01-15T12:00:00+00:00",
    "resolution": "0p25",
    "prediction_type": "sunset"
  }
        """
    )
    parser.add_argument('--lat', type=float, required=True,
                        help='中心纬度 (-90 到 90)')
    parser.add_argument('--lon', type=float, required=True,
                        help='中心经度 (-180 到 180)')
    parser.add_argument('--radius', type=int, default=200,
                        help='半径（公里），默认200')
    parser.add_argument('--type', choices=['sunrise', 'sunset'], default='sunset',
                        help='预测类型：sunrise（日出）或 sunset（日落），默认sunset')
    parser.add_argument('--resolution', choices=['0p25', '0p50'], default='0p25',
                        help='GFS分辨率：0p25（0.25度，约25km）或 0p50（0.5度，约50km），默认0p25')
    parser.add_argument('--verbose', '-v', action='store_true',
                        help='详细输出模式')

    args = parser.parse_args()

    # 验证参数
    if args.lat < -90 or args.lat > 90:
        print(json.dumps({'error': '纬度必须在-90到90之间'}))
        return 1
    if args.lon < -180 or args.lon > 180:
        print(json.dumps({'error': '经度必须在-180到180之间'}))
        return 1
    if args.radius < 50 or args.radius > 500:
        print(json.dumps({'error': '半径必须在50到500公里之间'}))
        return 1

    try:
        print(f"[GFS Processor] 开始处理...", file=sys.stderr)
        print(f"[GFS Processor] 参数: lat={args.lat}, lon={args.lon}, radius={args.radius}km, type={args.type}", file=sys.stderr)

        # 创建处理器
        processor = GFSDataProcessor(
            lat=args.lat,
            lon=args.lon,
            radius_km=args.radius,
            prediction_type=args.type,
            resolution=args.resolution
        )

        # 执行处理
        result = processor.process()

        # 输出JSON到stdout（供Node.js调用）
        print(json.dumps(result))

        return 0

    except Exception as e:
        # 输出错误JSON到stdout（供Node.js解析）
        error_result = {
            'error': str(e),
            'error_type': type(e).__name__
        }
        print(json.dumps(error_result))
        return 1


if __name__ == '__main__':
    sys.exit(main())
