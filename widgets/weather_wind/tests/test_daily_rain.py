import tempfile
import unittest

from test_hourly_refresh import load_widget


class DailyRainTests(unittest.TestCase):
    def test_today_daily_probability_is_fetched_and_cached_including_zero(self):
        for probability in (0, 65, None):
            with self.subTest(probability=probability):
                module, http = load_widget()
                http.fetch_json.return_value = {
                    'daily': {'precipitation_probability_max': [probability, 99]},
                    'hourly': {'precipitation_probability': [5, 10]},
                }
                with tempfile.TemporaryDirectory() as directory:
                    options = {'latitude': 41.85, 'longitude': -87.65}
                    result = module.fetch(options, {}, ctx={'data_dir': directory})
                    cached = module.fetch(options, {}, ctx={'data_dir': directory})
                self.assertEqual(result['daily_rain_probability'], probability)
                self.assertEqual(cached['daily_rain_probability'], probability)
                self.assertEqual(http.fetch_json.call_count, 1)
                self.assertIn('daily=sunrise,sunset,precipitation_probability_max', http.fetch_json.call_args.args[0])

    def test_missing_daily_probability_is_unknown_not_zero(self):
        module, http = load_widget()
        http.fetch_json.return_value = {'daily': {}}
        with tempfile.TemporaryDirectory() as directory:
            result = module.fetch({'latitude': 41.85, 'longitude': -87.65}, {}, ctx={'data_dir': directory})
        self.assertIsNone(result['daily_rain_probability'])


if __name__ == '__main__':
    unittest.main()
