# Local MP4 conversion

Vendored worker wrapper: `@ffmpeg/ffmpeg` 0.12.15 from npm/jsDelivr.
Upstream: https://github.com/ffmpegwasm/ffmpeg.wasm (MIT; see LICENSE).

The converter downloads the pinned single-thread `@ffmpeg/core` 0.12.10 JavaScript
and WebAssembly files from jsDelivr only when MP4 fallback is requested.
No video, audio, user token or account information is uploaded to jsDelivr.

The FFmpeg core includes FFmpeg and libx264 and is GPL licensed. Core source,
build instructions and licensing: https://github.com/ffmpegwasm/ffmpeg.wasm/tree/main/packages/core
and https://github.com/ffmpegwasm/ffmpeg.wasm#license.
