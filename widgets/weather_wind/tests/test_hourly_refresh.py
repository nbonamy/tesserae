import importlib.util
import json
import os
import tempfile
import types
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import Mock, patch
from zoneinfo import ZoneInfo


def load_widget():
    http = types.ModuleType('app.plugin_http')
    http.fetch_json = Mock()
    spec = importlib.util.spec_from_file_location('weather_refresh_test', Path(__file__).parents[1] / 'server.py')
    module = importlib.util.module_from_spec(spec)
    with patch.dict('sys.modules', {'app.plugin_http': http}):
        spec.loader.exec_module(module)
    return module, http


class HourlyRefreshTests(unittest.TestCase):
    def test_fresh_cache_expires_when_location_hour_changes(self):
        module, _ = load_widget()
        zone = ZoneInfo('America/Chicago')
        written = datetime(2026, 11, 6, 15, 56, tzinfo=zone)
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'cache.json'
            path.write_text(json.dumps({'timezone': zone.key, '_cache_hour': '2026-11-06T15:00:00-06:00'}))
            os.utime(path, (written.timestamp(), written.timestamp()))
            with patch.object(module.time, 'time', return_value=datetime(2026, 11, 6, 15, 59, tzinfo=zone).timestamp()):
                self.assertIsNotNone(module._cached(path))
            with patch.object(module.time, 'time', return_value=datetime(2026, 11, 6, 16, 0, tzinfo=zone).timestamp()):
                self.assertIsNone(module._cached(path))

    def test_graph_uses_local_clock_even_when_current_observation_lags(self):
        module, http = load_widget()
        http.fetch_json.return_value = {
            'timezone': 'America/Chicago',
            'current': {'time': '2026-11-06T15:45', 'temperature_2m': 7},
            'hourly': {
                'time': ['2026-11-06T15:00', '2026-11-06T16:00', '2026-11-06T17:00'],
                'temperature_2m': [7, 6, 5],
                'precipitation_probability': [0, 0, 0],
                'weather_code': [0, 0, 0],
            },
        }
        now = datetime(2026, 11, 6, 16, 0, tzinfo=ZoneInfo('America/Chicago')).timestamp()
        with tempfile.TemporaryDirectory() as directory, patch.object(module.time, 'time', return_value=now):
            result = module.fetch({'latitude': -37.81, 'longitude': 144.96}, {}, ctx={'data_dir': directory})
        self.assertEqual(result['points'][0]['iso'], '2026-11-06T16:00')
        self.assertEqual(result['temps'], [6, 5])

    def test_half_hour_timezone_uses_its_own_hour_boundary(self):
        module, _ = load_widget()
        zone = ZoneInfo('Asia/Kolkata')
        written = datetime(2026, 11, 6, 15, 56, tzinfo=zone).timestamp()
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / 'cache.json'
            path.write_text(json.dumps({'timezone': zone.key, '_cache_hour': '2026-11-06T15:00:00+05:30'}))
            os.utime(path, (written, written))
            with patch.object(module.time, 'time', return_value=datetime(2026, 11, 6, 16, 0, tzinfo=zone).timestamp()):
                self.assertIsNone(module._cached(path))


if __name__ == '__main__':
    unittest.main()
