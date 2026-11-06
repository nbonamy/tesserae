# Weather and Wind

A custom Tesserae widget for an 800 × 480 e-ink weather screen:

- Hourly temperature curve and weather icons.
- Current and feels-like temperatures, with large low/high readings.
- Wind direction and speed.
- Sunrise and sunset icons with local times.

## Deploy to your server

An existing Tesserae Docker container and SSH access are required. The SSH
user needs Docker access, directly or through passwordless sudo.

```sh
cp .env.example .env
# Edit .env with your server, deployment directory, and container name.
./deploy.sh
```

The script copies only `widgets/weather_wind/`, excluding Python caches,
into the container's persistent `/app/data/authored/weather_wind/` directory
and restarts Tesserae. It does not upload `.env` or change server configuration.
Keep `.env` private; Git ignores it.

In Tesserae, add **Weather and Wind** to a dashboard and choose your location,
forecast window, and units. For automatic updates, set the dashboard's content
refresh to 60 minutes, or configure a 60-minute background refresh when using
a Lineup.

## Checks

```sh
python3 -m unittest discover -s widgets/weather_wind/tests -p test_sun_times.py
node widgets/weather_wind/tests/test_client.mjs
bash -n deploy.sh
```

## License

Derived from Tesserae's `weather_hourly` widget. See [LICENSE](LICENSE) and
[NOTICE.md](NOTICE.md) for the AGPL-3.0 license and attribution.
