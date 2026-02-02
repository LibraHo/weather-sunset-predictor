#!/usr/bin/env python3
"""
GFS数据处理服务 - 火烧云地图覆盖层生成器

功能：
1. 从NOAA下载GFS GRIB2数据
2. 解析气象变量（TCDC, LCDC, MCDC, HCDC）
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
        "timestamp": 1640000000000
    }
"""

import argparse
import json
import os
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import requests
from PIL import Image
import xarray as xr


class GFSDataProcessor:
    """GFS数据处理类"""

    # NOAA GFS数据源URL
    GFS_BASE_URL = "https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod"

    # 需要下载的气象变量
    VARIABLES = ['TCDC', 'LCDC', 'MCDC', 'HCDC']

    def __init__(self, lat, lon, radius_km=200, prediction_type='sunset'):
        """
        初始化GFS数据处理器

        Args:
            lat: 中心纬度
            lon: 中心经度
            radius_km: 半径（公里）
            prediction_type: 预测类型（sunrise/sunset）
        """
        self.lat = lat
        self.lon = lon
        self.radius_km = radius_km
        self.prediction_type = prediction_type

        # 计算数据边界（0.25°分辨率约25km）
        self.delta_lat = (radius_km / 25) / 111  # 纬度1度约111km
        self.delta_lon = (radius_km / 25) / (111 * np.cos(np.radians(lat)))  # 经度随纬度变化

        self.bounds = {
            'north': lat + self.delta_lat,
            'south': lat - self.delta_lat,
            'east': lon + self.delta_lon,
            'west': lon - self.delta_lon
        }

    def download_gfs_data(self):
        """
        下载GFS GRIB2数据

        Returns:
            str: 下载的GRIB2文件路径
        """
        print(f"[GFS Processor] 下载GFS数据: {self.lat}, {self.lon}, 半径: {self.radius_km}km", file=sys.stderr)

        # 构造下载URL
        # 使用最新的GFS运行（gfs.YYYYMMDD/HH）
        now = datetime.now(timezone.utc)
        url = f"{self.GFS_BASE_URL}/gfs.{now.strftime('%Y%m%d')}/{now.strftime('%H')}/atmos/gfs.t{now.strftime('%H')}z.pgrb2.0p25.f000"

        print(f"[GFS Processor] 下载URL: {url}", file=sys.stderr)

        try:
            # 下载数据（流式传输）
            response = requests.get(url, stream=True, timeout=60)
            response.raise_for_status()

            # 保存到临时文件
            temp_file = tempfile.NamedTemporaryFile(suffix='.grib2', delete=False)
            for chunk in response.iter_content(chunk_size=8192):
                temp_file.write(chunk)
            temp_file.close()

            print(f"[GFS Processor] 下载完成: {temp_file.name}", file=sys.stderr)
            return temp_file.name

        except requests.RequestException as e:
            print(f"[GFS Processor] 下载失败: {e}", file=sys.stderr)
            raise Exception(f"无法下载GFS数据: {e}")

    def parse_grib2(self, grib2_file):
        """
        解析GRIB2文件

        Args:
            grib2_file: GRIB2文件路径

        Returns:
            xarray.Dataset: 包含气象变量的数据集
        """
        print(f"[GFS Processor] 解析GRIB2文件: {grib2_file}", file=sys.stderr)

        try:
            # 使用cfgrib引擎打开GRIB2文件
            ds = xr.open_dataset(grib2_file, engine='cfgrib')

            print(f"[GFS Processor] 可用变量: {list(ds.data_vars.keys())}", file=sys.stderr)
            print(f"[GFS Processor] 数据维度: {dict(ds.dims)}", file=sys.stderr)

            return ds

        except Exception as e:
            print(f"[GFS Processor] 解析失败: {e}", file=sys.stderr)
            raise Exception(f"无法解析GRIB2文件: {e}")

    def calculate_firecloud_probability(self, ds):
        """
        计算火烧云概率（光路追踪+云量评分算法）

        Args:
            ds: xarray数据集

        Returns:
            np.ndarray: 概率矩阵（0-1范围）
        """
        print(f"[GFS Processor] 计算火烧云概率...", file=sys.stderr)

        try:
            # 提取云量数据
            lcdc = ds['LCDC'].values  # 低云量
            mcdc = ds['MCDC'].values  # 中云量
            hcdc = ds['HCDC'].values  # 高云量

            print(f"[GFS Processor] LCDC shape: {lcdc.shape}, range: [{lcdc.min():.1f}, {lcdc.max():.1f}]", file=sys.stderr)
            print(f"[GFS Processor] MCDC shape: {mcdc.shape}, range: [{mcdc.min():.1f}, {mcdc.max():.1f}]", file=sys.stderr)
            print(f"[GFS Processor] HCDC shape: {hcdc.shape}, range: [{hcdc.min():.1f}, {hcdc.max():.1f}]", file=sys.stderr)

            # 初始化概率矩阵
            height, width = lcdc.shape[-2:]
            probability = np.zeros((height, width), dtype=np.float32)

            # 光路追踪算法
            # 对于日落，向西检查（经度减小方向）
            # 对于日出，向东检查（经度增加方向）
            direction = -1 if self.prediction_type == 'sunset' else 1

            for i in range(height):
                for j in range(width):
                    # 向西/向东检查10个网格点（约250km）
                    light_path_values = []
                    for k in range(10):
                        check_j = j + direction * k
                        if 0 <= check_j < width:
                            light_path_values.append(lcdc[..., i, check_j])

                    if light_path_values:
                        # 计算光路上的低云阻挡
                        blocking_clouds = np.mean(np.array(light_path_values) > 50)

                        # 本地中高云量评分
                        local_cloud_score = (mcdc[..., i, j] + hcdc[..., i, j]) / 2

                        # 综合评分
                        if blocking_clouds < 0.3:
                            # 光路通畅
                            prob = local_cloud_score / 100
                        else:
                            # 光路被阻，降低评分
                            prob = local_cloud_score / 200

                        probability[i, j] = np.clip(prob, 0, 1)

            print(f"[GFS Processor] 概率矩阵 shape: {probability.shape}, range: [{probability.min():.3f}, {probability.max():.3f}]", file=sys.stderr)

            return probability

        except Exception as e:
            print(f"[GFS Processor] 概率计算失败: {e}", file=sys.stderr)
            raise Exception(f"无法计算火烧云概率: {e}")

    def generate_overlay_png(self, probability_matrix):
        """
        生成RGBA PNG覆盖层

        Args:
            probability_matrix: 概率矩阵（0-1范围）

        Returns:
            str: 生成的PNG文件路径
        """
        print(f"[GFS Processor] 生成PNG覆盖层...", file=sys.stderr)

        try:
            # 归一化到0-255
            normalized = (probability_matrix * 255).astype(np.uint8)

            height, width = normalized.shape

            # 创建RGBA图像数组
            img_array = np.zeros((height, width, 4), dtype=np.uint8)

            # 应用颜色映射
            for i in range(height):
                for j in range(width):
                    prob = probability_matrix[i, j]

                    if prob < 0.3:
                        # 灰色渐变（0-30%）
                        alpha = int(prob * 255 / 0.3)
                        img_array[i, j] = [128, 128, 128, alpha]
                    elif prob < 0.7:
                        # 黄色渐变（30-70%）
                        normalized_prob = (prob - 0.3) / 0.4
                        alpha = int(180 + normalized_prob * 75)
                        img_array[i, j] = [255, 255, 0, alpha]
                    else:
                        # 红橙色渐变（70-100%）
                        normalized_prob = (prob - 0.7) / 0.3
                        alpha = int(180 + normalized_prob * 75)
                        red = 255
                        green = int((1 - normalized_prob) * 165)
                        img_array[i, j] = [red, green, 0, alpha]

            # 生成PNG图像
            img = Image.fromarray(img_array, mode='RGBA')
            temp_file = tempfile.NamedTemporaryFile(suffix='_firecloud_overlay.png', delete=False)
            img.save(temp_file.name, 'PNG')
            temp_file.close()

            print(f"[GFS Processor] PNG生成完成: {temp_file.name}", file=sys.stderr)

            return temp_file.name

        except Exception as e:
            print(f"[GFS Processor] PNG生成失败: {e}", file=sys.stderr)
            raise Exception(f"无法生成PNG覆盖层: {e}")

    def process(self):
        """
        完整处理流程

        Returns:
            dict: 包含image_path, bounds, timestamp的字典
        """
        timestamp = int(datetime.now(timezone.utc).timestamp() * 1000)

        try:
            # 1. 下载GFS数据
            grib2_file = self.download_gfs_data()

            # 2. 解析GRIB2
            ds = self.parse_grib2(grib2_file)

            # 3. 计算火烧云概率
            probability = self.calculate_firecloud_probability(ds)

            # 4. 生成PNG覆盖层
            image_path = self.generate_overlay_png(probability)

            # 5. 清理临时GRIB2文件
            try:
                os.unlink(grib2_file)
            except:
                pass

            # 6. 返回结果
            result = {
                'image_path': image_path,
                'bounds': self.bounds,
                'timestamp': timestamp
            }

            print(f"[GFS Processor] 处理完成", file=sys.stderr)
            return result

        except Exception as e:
            print(f"[GFS Processor] 处理失败: {e}", file=sys.stderr)
            raise


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='GFS数据处理服务')
    parser.add_argument('--lat', type=float, required=True, help='中心纬度')
    parser.add_argument('--lon', type=float, required=True, help='中心经度')
    parser.add_argument('--radius', type=int, default=200, help='半径（公里）')
    parser.add_argument('--type', choices=['sunrise', 'sunset'], default='sunset', help='预测类型')

    args = parser.parse_args()

    try:
        # 创建处理器
        processor = GFSDataProcessor(
            lat=args.lat,
            lon=args.lon,
            radius_km=args.radius,
            prediction_type=args.type
        )

        # 执行处理
        result = processor.process()

        # 输出JSON到stdout
        print(json.dumps(result))

        return 0

    except Exception as e:
        # 输出错误到stderr
        print(json.dumps({'error': str(e)}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    sys.exit(main())
