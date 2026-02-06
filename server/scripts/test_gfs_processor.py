#!/usr/bin/env python3
"""
GFS处理器单元测试

测试 gfs_processor.py 的核心功能（不依赖网络下载和xarray）

需求：22 (Phase 6 - 火烧云地图重构)
"""

import unittest
import numpy as np
import tempfile
import os
import sys
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock

# Mock xarray before importing gfs_processor
sys.modules['xarray'] = MagicMock()

# 导入被测模块
from gfs_processor import GFSDataProcessor


class TestGFSDataProcessorInit(unittest.TestCase):
    """测试GFSDataProcessor初始化"""

    def test_init_basic(self):
        """基本初始化测试"""
        processor = GFSDataProcessor(lat=39.9, lon=116.4)

        self.assertEqual(processor.lat, 39.9)
        self.assertEqual(processor.lon, 116.4)
        self.assertEqual(processor.radius_km, 200)
        self.assertEqual(processor.prediction_type, 'sunset')
        self.assertEqual(processor.resolution, '0p25')

    def test_init_with_options(self):
        """带参数初始化测试"""
        processor = GFSDataProcessor(
            lat=31.2,
            lon=121.5,
            radius_km=100,
            prediction_type='sunrise',
            resolution='0p50'
        )

        self.assertEqual(processor.lat, 31.2)
        self.assertEqual(processor.lon, 121.5)
        self.assertEqual(processor.radius_km, 100)
        self.assertEqual(processor.prediction_type, 'sunrise')
        self.assertEqual(processor.resolution, '0p50')

    def test_bounds_calculation(self):
        """边界计算测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0, radius_km=100)

        # 检查边界是否合理
        self.assertGreater(processor.bounds['north'], processor.lat)
        self.assertLess(processor.bounds['south'], processor.lat)
        self.assertGreater(processor.bounds['east'], processor.lon)
        self.assertLess(processor.bounds['west'], processor.lon)

        # 检查边界在有效范围内
        self.assertLessEqual(processor.bounds['north'], 90)
        self.assertGreaterEqual(processor.bounds['south'], -90)
        self.assertLessEqual(processor.bounds['east'], 180)
        self.assertGreaterEqual(processor.bounds['west'], -180)

    def test_bounds_polar_region(self):
        """极地区域边界测试"""
        # 靠近北极（使用更大半径确保超出90度）
        processor = GFSDataProcessor(lat=89.0, lon=0.0, radius_km=500)
        self.assertEqual(processor.bounds['north'], 90)  # 应该被限制在90

        # 靠近南极
        processor = GFSDataProcessor(lat=-89.0, lon=0.0, radius_km=500)
        self.assertEqual(processor.bounds['south'], -90)  # 应该被限制在-90


class TestGFSRunTimeCalculation(unittest.TestCase):
    """测试GFS运行时间计算"""

    def test_get_latest_gfs_run(self):
        """获取最近GFS运行时间测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0)
        run_time = processor._get_latest_gfs_run()

        # 运行时间应该在过去
        now = datetime.now(timezone.utc)
        self.assertLess(run_time, now)

        # 运行小时应该是0, 6, 12, 18之一
        self.assertIn(run_time.hour, [0, 6, 12, 18])

        # 应该在24小时内
        time_diff = now - run_time
        self.assertLess(time_diff.total_seconds(), 24 * 3600)

    def test_build_gfs_url_025(self):
        """构建0.25度分辨率URL测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0, resolution='0p25')
        run_time = datetime(2024, 1, 15, 12, 0, 0, tzinfo=timezone.utc)

        url = processor._build_gfs_url(run_time, forecast_hour=0)

        self.assertIn('20240115', url)
        self.assertIn('12', url)
        self.assertIn('0p25', url)
        self.assertIn('f000', url)

    def test_build_gfs_url_050(self):
        """构建0.5度分辨率URL测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0, resolution='0p50')
        run_time = datetime(2024, 1, 15, 6, 0, 0, tzinfo=timezone.utc)

        url = processor._build_gfs_url(run_time, forecast_hour=6)

        self.assertIn('20240115', url)
        self.assertIn('06', url)
        self.assertIn('0p50', url)
        self.assertIn('f006', url)


class TestGaussianScore(unittest.TestCase):
    """测试高斯评分函数"""

    def test_gaussian_score_optimal(self):
        """最优值测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0)

        # 在最优值时应该返回1.0
        score = processor._gaussian_score(50, optimal=50, sigma=25)
        self.assertAlmostEqual(score, 1.0, places=6)

    def test_gaussian_score_deviation(self):
        """偏离值测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0)

        # 偏离最优值时应该小于1.0
        score = processor._gaussian_score(75, optimal=50, sigma=25)
        self.assertLess(score, 1.0)
        self.assertGreater(score, 0.0)

    def test_gaussian_score_symmetry(self):
        """对称性测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0)

        # 相同偏离量的评分应该相等
        score_higher = processor._gaussian_score(75, optimal=50, sigma=25)
        score_lower = processor._gaussian_score(25, optimal=50, sigma=25)
        self.assertAlmostEqual(score_higher, score_lower, places=6)


class TestFirecloudProbability(unittest.TestCase):
    """测试火烧云概率计算"""

    def test_calculate_firecloud_probability_basic(self):
        """基本概率计算测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0)

        # 创建模拟云量数据
        height, width = 10, 20
        cloud_data = {
            'low': np.random.uniform(0, 100, (height, width)),
            'mid': np.random.uniform(0, 100, (height, width)),
            'high': np.random.uniform(0, 100, (height, width)),
            'lats': np.linspace(39, 41, height),
            'lons': np.linspace(115, 117, width)
        }

        probability = processor.calculate_firecloud_probability(cloud_data)

        # 检查输出形状
        self.assertEqual(probability.shape, (height, width))

        # 检查值范围
        self.assertGreaterEqual(probability.min(), 0)
        self.assertLessEqual(probability.max(), 1)

    def test_calculate_firecloud_ideal_conditions(self):
        """理想条件下的概率测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0, prediction_type='sunset')

        height, width = 5, 10
        # 理想条件：无低云，适量中高云
        cloud_data = {
            'low': np.zeros((height, width)),  # 无低云
            'mid': np.full((height, width), 50),  # 适量中云
            'high': np.full((height, width), 40),  # 适量高云
            'lats': np.linspace(39, 41, height),
            'lons': np.linspace(115, 117, width)
        }

        probability = processor.calculate_firecloud_probability(cloud_data)

        # 理想条件下应该有较高的概率
        self.assertGreater(probability.mean(), 0.3)

    def test_calculate_firecloud_poor_conditions(self):
        """恶劣条件下的概率测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0, prediction_type='sunset')

        height, width = 5, 10
        # 恶劣条件：大量低云
        cloud_data = {
            'low': np.full((height, width), 100),  # 满低云
            'mid': np.full((height, width), 50),
            'high': np.full((height, width), 50),
            'lats': np.linspace(39, 41, height),
            'lons': np.linspace(115, 117, width)
        }

        probability = processor.calculate_firecloud_probability(cloud_data)

        # 恶劣条件下应该有较低的概率
        self.assertLess(probability.mean(), 0.3)


class TestRegionSubset(unittest.TestCase):
    """测试区域裁剪功能"""

    def test_subset_to_region(self):
        """区域裁剪测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0, radius_km=50)

        # 创建全球数据
        global_height, global_width = 721, 1440
        lats = np.linspace(90, -90, global_height)
        lons = np.linspace(0, 359.75, global_width)

        cloud_data = {
            'low': np.random.uniform(0, 100, (global_height, global_width)),
            'mid': np.random.uniform(0, 100, (global_height, global_width)),
            'high': np.random.uniform(0, 100, (global_height, global_width)),
            'lats': lats,
            'lons': lons
        }

        subset = processor._subset_to_region(cloud_data)

        # 裁剪后的数据应该更小
        self.assertLess(subset['low'].shape[0], global_height)
        self.assertLess(subset['low'].shape[1], global_width)

        # 裁剪后的坐标应该在边界内
        self.assertGreaterEqual(subset['lats'].min(), processor.bounds['south'] - 1)
        self.assertLessEqual(subset['lats'].max(), processor.bounds['north'] + 1)


class TestOverlayPNG(unittest.TestCase):
    """测试PNG覆盖层生成"""

    def test_generate_overlay_png_basic(self):
        """基本PNG生成测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0)

        # 创建测试概率矩阵
        probability = np.random.uniform(0, 1, (50, 100))

        image_path = processor.generate_overlay_png(probability)

        # 检查文件存在
        self.assertTrue(os.path.exists(image_path))

        # 检查文件大小
        file_size = os.path.getsize(image_path)
        self.assertGreater(file_size, 0)

        # 清理
        os.unlink(image_path)

    def test_generate_overlay_png_color_mapping(self):
        """颜色映射测试"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0)

        # 创建渐变概率矩阵（0到1）
        height, width = 10, 100
        probability = np.tile(np.linspace(0, 1, width), (height, 1))

        image_path = processor.generate_overlay_png(probability)

        # 验证文件生成
        self.assertTrue(os.path.exists(image_path))

        # 可以进一步验证图像内容（如果需要）
        from PIL import Image
        img = Image.open(image_path)
        self.assertEqual(img.mode, 'RGBA')
        self.assertEqual(img.size, (width, height))

        # 清理
        os.unlink(image_path)


class TestParameterValidation(unittest.TestCase):
    """测试参数验证"""

    def test_valid_latitude_range(self):
        """有效纬度范围测试"""
        # 应该不抛出异常
        GFSDataProcessor(lat=0, lon=0)
        GFSDataProcessor(lat=90, lon=0)
        GFSDataProcessor(lat=-90, lon=0)
        GFSDataProcessor(lat=45.5, lon=0)

    def test_valid_longitude_range(self):
        """有效经度范围测试"""
        # 应该不抛出异常
        GFSDataProcessor(lat=0, lon=0)
        GFSDataProcessor(lat=0, lon=180)
        GFSDataProcessor(lat=0, lon=-180)
        GFSDataProcessor(lat=0, lon=116.4)


class TestIntegration(unittest.TestCase):
    """集成测试（使用Mock避免网络请求）"""

    @patch.object(GFSDataProcessor, 'download_gfs_data')
    def test_process_with_mock_download(self, mock_download):
        """使用Mock数据测试完整处理流程"""
        processor = GFSDataProcessor(lat=40.0, lon=116.0, radius_km=50)

        # Mock下载函数返回一个不存在的文件（会导致解析失败）
        mock_download.return_value = '/tmp/nonexistent.grib2'

        # 由于GRIB2文件不存在，应该抛出异常
        with self.assertRaises(Exception):
            processor.process()


if __name__ == '__main__':
    unittest.main(verbosity=2)
