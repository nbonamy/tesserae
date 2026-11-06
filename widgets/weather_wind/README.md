# Weather and Wind

A Tesserae widget for an 800 × 480 e-ink weather screen:

- Hourly temperature curve and weather icons, starting at the current local hour.
- Current and feels-like temperatures, with large low/high readings.
- Wind direction and speed.
- Sunrise and sunset icons with local times.

## Use

Deploy with the repository's [deployment script](../../README.md#deploy), then
add **Weather and Wind** to a dashboard in Tesserae. Choose your location,
forecast window, and units in the widget settings.

For automatic updates, set the dashboard's content refresh to 60 minutes, or
configure a 60-minute background refresh when using a Lineup.

## Checks

Run from the repository root:

```sh
python3 -m unittest discover -s widgets/weather_wind/tests -p 'test_*.py'
node widgets/weather_wind/tests/test_client.mjs
```

## License

Licensed under [AGPL-3.0](LICENSE). This widget is derived from Tesserae's
`weather_hourly` widget; see [NOTICE.md](NOTICE.md) for upstream attribution.
The repository's default Apache 2.0 license does not apply to this folder.
