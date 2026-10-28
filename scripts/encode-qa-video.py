"""Encode recorded CDP frames without changing their ordering or capture intervals.

Requires Pillow and an explicitly supplied ffmpeg executable. The original frame
manifest and images stay untouched. H.264 uses lossless encoding after the normal
JPEG-to-yuv420p video conversion; decoded hashes verify every encoded frame.
"""

import argparse
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import subprocess

from PIL import Image


REPO = Path(__file__).resolve().parents[1]
EVIDENCE = (REPO / "output" / "qa-v2.1").resolve()


def sha256(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def run(ffmpeg, arguments):
    result = subprocess.run([str(ffmpeg), "-hide_banner", "-nostdin", "-n", *arguments],
                            capture_output=True, text=True, encoding="utf-8", errors="replace")
    if result.returncode:
        raise RuntimeError(result.stderr[-12000:])
    return result.stderr


def read_frame_hashes(path):
    text = path.read_text(encoding="utf-8")
    timebase = re.search(r"#tb 0: (\d+)/(\d+)", text)
    dimensions = re.search(r"#dimensions 0: (\d+)x(\d+)", text)
    if not timebase or not dimensions:
        raise ValueError("Missing frame-hash timebase or dimensions")
    frames = []
    for line in text.splitlines():
        if not line or line.startswith("#"):
            continue
        fields = [part.strip() for part in line.split(",")]
        frames.append({"pts": int(fields[2]), "duration": int(fields[3]), "md5": fields[5]})
    return {
        "timebase": [int(timebase[1]), int(timebase[2])],
        "dimensions": [int(dimensions[1]), int(dimensions[2])],
        "frames": frames,
    }


def encode_playback_copy(ffmpeg, concat, prefix, source_hashes):
    """Produce a broadly supported H.264 profile while retaining exact frame PTS."""
    video = prefix.with_name(prefix.name + "-playback.mp4")
    hashes = prefix.with_name(prefix.name + "-playback.framemd5")
    report = prefix.with_name(prefix.name + "-playback-verification.json")
    if any(path.exists() for path in [video, hashes, report]):
        raise FileExistsError("A playback artifact already exists; refusing to overwrite it")
    arguments = ["-f", "concat", "-safe", "0", "-i", str(concat), "-map", "0:v:0", "-an",
                 "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
                 "-profile:v", "high", "-level:v", "4.2", "-bf", "0", "-x264-params", "fps=60/1:force-cfr=0",
                 "-fps_mode", "passthrough", "-enc_time_base", "1:1000000",
                 "-video_track_timescale", "1000000", "-movflags", "+faststart", str(video)]
    log = run(ffmpeg, arguments)
    run(ffmpeg, ["-i", str(video), "-map", "0:v:0", "-an", "-pix_fmt", "yuv420p",
                 "-fps_mode", "passthrough", "-enc_time_base", "1:1000000", "-f", "framemd5", str(hashes)])
    source, decoded = read_frame_hashes(source_hashes), read_frame_hashes(hashes)
    if (source["dimensions"] != decoded["dimensions"] or source["timebase"] != decoded["timebase"]
            or len(source["frames"]) != len(decoded["frames"])
            or any(a["pts"] != b["pts"] for a, b in zip(source["frames"], decoded["frames"]))):
        raise ValueError("Playback frame count, dimensions, or timestamps differ from the source")
    result = {
        "video": video.relative_to(REPO).as_posix(), "videoSha256": sha256(video),
        "videoBytes": video.stat().st_size, "decodedFrameCount": len(decoded["frames"]),
        "dimensions": decoded["dimensions"], "timebase": "1/1000000",
        "maxTimestampErrorMicroseconds": 0,
        "firstFramePtsMicroseconds": decoded["frames"][0]["pts"],
        "lastFramePtsMicroseconds": decoded["frames"][-1]["pts"],
        "finalFrameDurationMicroseconds": decoded["frames"][-1]["duration"],
        "encoding": "H.264 High level 4.2, CRF18, yuv420p; playback copy uses lossy compression. No resize, interpolation, dropped or added frames, or audio.",
        "browserPlaybackVerified": False,
        "ffmpegArguments": arguments, "ffmpegLog": log,
    }
    report.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items()
                      if key not in {"ffmpegArguments", "ffmpegLog"}}, indent=2))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest", type=Path)
    parser.add_argument("--ffmpeg", required=True, type=Path)
    parser.add_argument("--playback-only", action="store_true", help="Add a playback copy to an already verified lossless encoding")
    args = parser.parse_args()
    manifest = args.manifest.resolve()
    if manifest.parent != EVIDENCE or not manifest.name.endswith("-frames.json"):
        raise ValueError("Manifest must be output/qa-v2.1/*-frames.json")
    records = json.loads(manifest.read_text(encoding="utf-8"), parse_float=Decimal)
    if not isinstance(records, list) or len(records) < 2:
        raise ValueError("At least two recorded frames are required")
    paths, timestamps, dimensions = [], [], set()
    for record in records:
        path = (REPO / record["path"]).resolve()
        if path.parent != EVIDENCE or path.suffix.lower() not in {".jpg", ".jpeg", ".png"}:
            raise ValueError("Every frame must be an image in output/qa-v2.1")
        if path.stat().st_size != record["bytes"] or sha256(path) != record["sha256"]:
            raise ValueError(f"Recorded hash or size mismatch: {path.name}")
        with Image.open(path) as image:
            dimensions.add(image.size)
            image.verify()
        timestamp = Decimal(str(record["timestamp"]))
        if not timestamp.is_finite() or (timestamps and timestamp <= timestamps[-1]):
            raise ValueError("Capture timestamps must be finite and strictly increasing")
        paths.append(path)
        timestamps.append(timestamp)
    if len(set(paths)) != len(paths) or len(dimensions) != 1:
        raise ValueError("Frames must have unique paths and matching dimensions")
    width, height = next(iter(dimensions))
    if width % 2 or height % 2:
        raise ValueError("yuv420p requires even dimensions; this script never resizes frames")

    prefix = manifest.with_name(manifest.name.removesuffix("-frames.json"))
    concat = prefix.with_suffix(".ffconcat")
    video = prefix.with_suffix(".mp4")
    source_hashes = prefix.with_name(prefix.name + "-source.framemd5")
    video_hashes = prefix.with_name(prefix.name + "-decoded.framemd5")
    report = prefix.with_name(prefix.name + "-video-verification.json")
    if args.playback_only:
        if not report.exists():
            raise FileNotFoundError("The original verification report is required")
        encode_playback_copy(args.ffmpeg, concat, prefix, source_hashes)
        return
    targets = [concat, video, source_hashes, video_hashes, report]
    if any(path.exists() for path in targets):
        raise FileExistsError("An encoding artifact already exists; refusing to overwrite it")

    offsets = [int(((value - timestamps[0]) * 1_000_000).to_integral_value()) for value in timestamps]
    if any(right <= left for left, right in zip(offsets, offsets[1:])):
        raise ValueError("Capture timestamps collapse at the MP4 microsecond timebase")
    lines = ["ffconcat version 1.0"]
    for index, path in enumerate(paths):
        if not re.fullmatch(r"[A-Za-z0-9_.-]+", path.name):
            raise ValueError("Frame filenames must use safe ASCII basename characters")
        lines.extend([f"file '{path.name}'", "option framerate 1000000"])
        if index < len(paths) - 1:
            lines.append(f"duration {Decimal(offsets[index + 1] - offsets[index]) / 1_000_000:.6f}")
    concat.write_text("\n".join(lines) + "\n", encoding="utf-8")
    input_args = ["-f", "concat", "-safe", "0", "-i", str(concat)]
    encode_args = [*input_args, "-map", "0:v:0", "-an", "-c:v", "libx264", "-preset", "medium",
                   "-crf", "0", "-pix_fmt", "yuv420p", "-bf", "0", "-fps_mode", "passthrough",
                   "-enc_time_base", "1:1000000", "-video_track_timescale", "1000000",
                   "-movflags", "+faststart", str(video)]
    encode_log = run(args.ffmpeg, encode_args)
    hash_args = ["-map", "0:v:0", "-an", "-pix_fmt", "yuv420p", "-fps_mode", "passthrough",
                 "-enc_time_base", "1:1000000", "-f", "framemd5"]
    run(args.ffmpeg, [*input_args, *hash_args, str(source_hashes)])
    run(args.ffmpeg, ["-i", str(video), *hash_args, str(video_hashes)])
    source = read_frame_hashes(source_hashes)
    decoded = read_frame_hashes(video_hashes)
    if source["timebase"] != [1, 1_000_000] or decoded["timebase"] != [1, 1_000_000]:
        raise ValueError("Unexpected verification timebase")
    if len(source["frames"]) != len(records) or len(decoded["frames"]) != len(records):
        raise ValueError("Encoded frame count differs from recorded frame count")
    if source["dimensions"] != [width, height] or decoded["dimensions"] != [width, height]:
        raise ValueError("Encoded dimensions differ from the captured images")
    for index, (before, after) in enumerate(zip(source["frames"], decoded["frames"])):
        if before["md5"] != after["md5"] or before["pts"] != offsets[index] or after["pts"] != offsets[index]:
            raise ValueError(f"Frame content/order/timestamp mismatch at index {index}")

    result = {
        "manifest": manifest.relative_to(REPO).as_posix(), "manifestSha256": sha256(manifest),
        "video": video.relative_to(REPO).as_posix(), "videoSha256": sha256(video),
        "videoBytes": video.stat().st_size, "sourceFrameCount": len(records),
        "decodedFrameCount": len(decoded["frames"]), "width": width, "height": height,
        "firstFrame": records[0]["path"], "lastFrame": records[-1]["path"],
        "firstCaptureTimestamp": str(timestamps[0]), "lastCaptureTimestamp": str(timestamps[-1]),
        "captureSpanSeconds": str(timestamps[-1] - timestamps[0]),
        "timebase": "1/1000000", "maxTimestampErrorMicroseconds": 0,
        "allDecodedFrameHashesMatchNormalizedSource": True,
        "firstDecodedFrameMd5": decoded["frames"][0]["md5"],
        "lastDecodedFrameMd5": decoded["frames"][-1]["md5"],
        "timestampOffsetsMicroseconds": offsets,
        "finalFrameDurationMicroseconds": decoded["frames"][-1]["duration"],
        "lastFramePolicy": "No extra hold or duplicate frame; capture has no timestamp after its last frame.",
        "encoding": "H.264 lossless after JPEG-to-yuv420p conversion; no resize, interpolation, dropped or added frames; no audio.",
        "ffmpeg": str(args.ffmpeg), "ffmpegArguments": encode_args,
        "ffmpegLog": encode_log,
    }
    report.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in result.items()
                      if key not in {"ffmpegArguments", "ffmpegLog", "timestampOffsetsMicroseconds"}}, indent=2))
    encode_playback_copy(args.ffmpeg, concat, prefix, source_hashes)


if __name__ == "__main__":
    main()
