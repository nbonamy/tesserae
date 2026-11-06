"""Solar times come from the forecast location's local day, not the host clock."""
import importlib.util
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


class SunTimesTests(unittest.TestCase):
    def fetch(self, daily, apparent_temperature=17.4):
        payload = {
            "current": {"time": "2026-06-01T15:00", "temperature_2m": 20, "apparent_temperature": apparent_temperature},
            "hourly": {},
            "daily": daily,
        }
        http = types.ModuleType("app.plugin_http")
        http.fetch_json = Mock(return_value=payload)
        spec = importlib.util.spec_from_file_location("weather_wind_test", Path(__file__).parents[1] / "server.py")
        module = importlib.util.module_from_spec(spec)
        with patch.dict("sys.modules", {"app.plugin_http": http}):
            spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as data_dir:
            options = {"latitude": -37.81, "longitude": 144.96, "units": "metric"}
            result = module.fetch(options, {}, ctx={"data_dir": data_dir})
            cached = module.fetch(options, {}, ctx={"data_dir": data_dir})
            self.assertEqual(result, cached)
            self.assertEqual(http.fetch_json.call_count, 1)
        url = http.fetch_json.call_args.args[0]
        self.assertIn("daily=sunrise,sunset", url)
        self.assertIn("timezone=auto", url)
        self.assertIn("apparent_temperature", url)
        return result

    def test_local_sun_times_are_preserved_and_cached(self):
        result = self.fetch({"sunrise": ["2026-06-01T05:17", "2026-06-02T05:16"],
                             "sunset": ["2026-06-01T20:19", "2026-06-02T20:20"]})
        self.assertEqual((result["sunrise"], result["sunset"]), ("05:17", "20:19"))

    def test_feels_like_uses_apparent_temperature(self):
        self.assertEqual(self.fetch({})["feels_like"], 17.4)
        self.assertIsNone(self.fetch({}, apparent_temperature=None)["feels_like"])

    def test_unavailable_sun_events_do_not_break_weather(self):
        for daily in ({}, {"sunrise": [None], "sunset": [None]}):
            with self.subTest(daily=daily):
                result = self.fetch(daily)
                self.assertEqual((result["sunrise"], result["sunset"]), ("", ""))
                self.assertEqual(result["current"], 20)


if __name__ == "__main__":
    unittest.main()
