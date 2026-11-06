# Tesserae Custom Widgets

A collection of custom widgets for [Tesserae](https://github.com/dmellok/tesserae)
e-ink dashboards, with a script to deploy them to an existing server.

## Widgets

| Widget | Description | License |
| --- | --- | --- |
| [Weather and Wind](widgets/weather_wind/README.md) | Hourly weather, current and feels-like temperatures, low/high readings, wind, sunrise, and sunset. | [AGPL-3.0](widgets/weather_wind/LICENSE) |

Each widget's folder contains its source, documentation, tests, and any
widget-specific license and attribution.

## Deploy

An existing Tesserae Docker container and SSH access are required. The SSH
user needs Docker access, directly or through passwordless sudo.

```sh
cp .env.example .env
# Edit .env with your server, deployment directory, and container name.
./deploy.sh
```

The deployment script currently installs **Weather and Wind** into
`/app/data/authored/weather_wind/` and restarts Tesserae. It uploads only the
widget files, excluding Python caches. It does not upload `.env` or change
server configuration. Keep `.env` private; Git ignores it.

After deployment, add the widget to a dashboard in Tesserae and configure its
options. See the widget's README for details.

## License

[Apache 2.0](LICENSE) is the default license for this repository, including the
deployment script and repository-level documentation, **unless a file or
folder specifies a different license**. A folder's own `LICENSE` applies to
its contents, subject to any more specific licensing notices.

**Weather and Wind is AGPL-3.0**, as it derives from Tesserae's
`weather_hourly` widget. See its [license](widgets/weather_wind/LICENSE) and
[attribution](widgets/weather_wind/NOTICE.md). The repository's default Apache
license does not relicense that widget or other third-party code.
