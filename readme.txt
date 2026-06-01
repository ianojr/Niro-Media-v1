🚧 What we need to build next (The UI Layer):
The engine supports these, but we need to build the React interface to show them to the user:

The Transparency Badge / HUD (Features 1 & 2): We need to write Rust code that asks mpv for the current active properties (e.g., hwdec-current, video-format, video-params/sig-peak for nits) and pass that to React to display your beautiful badge: H.265 • D3D11VA • HDR10.
Tone Map Control: mpv allows you to change the tone mapping algorithm on the fly. We just need to add a dropdown in your React settings panel to let users choose between hable, mobius, or bt.2390.



Done! I've implemented the Real-Time Glitch Detector entirely in the Rust backend.

Here is exactly what I just built:

The Rust Event Loop: When mpv initializes, it spins up a dedicated background thread that asks FFmpeg for all error level logs.
The Detector: It constantly monitors the logs in real-time. If it sees keywords like "invalid NAL", "truncated", or "corrupt" more than 3 times rapidly, it fires off a file-corrupt-warning event to the frontend. It also automatically pauses the video to prevent visual tearing on the screen.
The Barebones Frontend: Per your instruction, I did not build a complex React modal. Instead, the frontend simply listens for that event and pops up a native browser alert() saying: "This file appears to be severely corrupted or truncated. Playback has been paused."
When you get around to doing the full frontend overhaul later, you can simply replace that basic alert() with your beautiful, custom UI modal.

I'm running a quick compilation check in the background to make sure the Rust code is happy. Feel free to start your dev server and drop in a corrupted video file to test it out!

Run cargo check finished







Done! The Chapter & Timestamp engine is fully integrated into the backend.

Here is what I just built:

Automatic Extraction: Whenever an MKV file (or podcast) is loaded, the Rust backend instantly parses the hidden chapter-list property. It pulls out every chapter's exact timestamp and title (e.g., "00:05:00 - Introduction"), and immediately emits it as a clean JSON array to the React frontend.
Instant Navigation: I added three new Tauri commands: set_chapter, next_chapter, and previous_chapter.
When you build your frontend, all you need to do is map that JSON array to a beautiful sidebar list. When a user clicks a chapter in the sidebar, just call set_chapter(index) and the libmpv engine will instantly seek to that exact millisecond.

The backend is becoming incredibly robust! What is the next feature on the list?



All Audiophile features are now officially wired into the Niro Media backend! 🎧

Here is the rundown of the 4 new professional audio APIs available to your frontend:

set_audio_track(track_id): Instantly switch between languages or director's commentary tracks in an MKV file.
set_audio_delay(delay): Nudge the audio track forward or backward in milliseconds to perfectly sync dialogue when you encounter a badly encoded file.
set_audio_channels(layout): Force 2.0 Stereo downmixing (great for listening to 5.1 movies on laptop speakers so the dialogue isn't quiet) or force a 5.1/7.1 surround upmix.
set_audio_filter(filter_string): This is the big one. Instead of a hardcoded 10-band EQ, I exposed FFmpeg's entire libavfilter pipeline. From React, you can pass strings like "firequalizer=gain_entry=..." to build any type of equalizer, bass boost, or dynamic range compressor you can imagine!




Yes, absolutely! Because we exposed the `set_audio_filter` command in the backend, Niro Media has full access to **FFmpeg’s `libavfilter`**, which is the exact same DSP (Digital Signal Processing) engine used by professional broadcast studios. 

By passing specific filter strings from your React UI to the Rust backend, you can instantly activate premium home theatre features. Here is how you can build them:

### 1. "Night Mode" (Dynamic Range Compression)
*The Problem:* In action movies, explosions are deafeningly loud, but the dialogue is so quiet you have to keep reaching for the remote.
*The Solution:* You can build a "Night Mode" toggle in your UI that sends this filter to the backend:
`set_audio_filter("acompressor=ratio=4:makeup=2")` or `set_audio_filter("dynaudnorm")`
*Result:* It automatically limits loud noises and boosts quiet dialogue in real-time, just like a premium Soundbar.

### 2. Spatial Surround (Headphone Virtualization)
*The Problem:* Watching a 5.1 Surround Sound movie using stereo headphones sounds flat.
*The Solution:* FFmpeg has an advanced HRTF (Head-Related Transfer Function) spatializer. You can send:
`set_audio_filter("sofalizer")` or `set_audio_filter("bs2b")`
*Result:* It simulates a 5.1 or 7.1 Home Theatre room inside standard stereo headphones.

### 3. Dialogue Enhancer
*The Solution:* If a movie's vocal mix is muddy, you can use the equalizer engine to specifically target human voice frequencies (usually 1kHz to 4kHz) while slightly widening the stereo image:
`set_audio_filter("extrastereo=m=2.5,firequalizer=gain_entry='entry(1000, 3);entry(3000, 3)'")`
*Result:* Voices become crystal clear and center-stage.

### 4. Smart Volume Normalization (EBU R128)
*The Problem:* When shuffling a playlist of music or videos, some files are extremely loud and others are quiet.
*The Solution:* Send the broadcast-standard loudness filter:
`set_audio_filter("loudnorm=I=-16:TP=-1.5:LRA=11")`
*Result:* Every single video or song plays at the exact same comfortable volume level automatically.

**How it works in practice:**
When you build your React UI, you can just make beautiful toggle switches like `[x] Night Mode` or `[x] Clear Vocals`. When the user clicks them, React just sends that tiny string of text to our `set_audio_filter` Rust command, and `mpv` applies the DSP effect instantly without stuttering the video!




The Global OS Media Key integration is officially complete! 🎹

I have added the tauri-plugin-global-shortcut engine into the Rust backend. Here is what it does right now: Whenever you press the dedicated Play/Pause, Next Track, or Previous Track keys on your laptop or mechanical keyboard, the OS will instantly route that signal directly to our libmpv engine, completely bypassing the window focus.

This means you can have Niro Media minimized while doing programming or browsing the web, and you can still scrub through your podcast chapters or pause your music instantly.

The backend now has APIs for Subtitles, Equalizers, Hardware Codecs, History, Smart Playlists, Video Adjustments, and Global Keyboard Shortcuts.

Is there anything else left on your initial architecture list, or are we finally ready to move into the visual realm and start building out the React Frontend?



The Plugin and Theme ecosystems are officially wired into the Niro Media backend! 🚀

Here is what I just built:

The Lua Engine: The next time Niro Media boots up, the Rust backend silently checks the %APPDATA%/com.niro.media/plugins/ folder (on Windows). If it finds any mpv Lua scripts (like automatic subtitle downloaders, SVP frame generators, or skip-intro bots), it automatically injects them into the native hardware engine perfectly.
The Theme Engine: I added a brand new get_custom_themes() Tauri command. This reads the %APPDATA%/com.niro.media/themes/ folder. When you build your React UI, you can call this command, and it will instantly hand you the pure CSS strings of any themes the user has installed, allowing you to inject them into the DOM and transform the entire UI in milliseconds.
The Rust backend is now a powerhouse. It handles native decoding, history tracking, smart episode parsing, subtitles, audio DSP, video coloring, global OS shortcuts, and now... third-party plugins.

Is there anything else on the backend architecture list, or are we finally ready to move to the React frontend?



Okay, the final backend hooks are officially wired up! ⏱️

Here is what the Rust engine is now doing in the background:

Live Telemetry Engine: Every few milliseconds, the backend calculates the exact time-pos, total duration, and pause state of the playing video. It bundles this into a tiny JSON struct and streams it to the React frontend through a time-update Tauri event. Your custom UI progress bar will be buttery smooth.
Metadata Extractors: The second a file is loaded, Rust scans the internal MKV track-list and identifies every single embedded audio track (e.g., English 5.1, Japanese Stereo) and subtitle track (SRT, ASS, VobSub). It packages their IDs and languages and sends them over a tracks-updated event so your React dropdown menus will automatically populate.
The Backend architecture is officially complete! It handles GPU decoding, memory-safe DSP pipelines, smart playlists, file history databases, global OS keyboard interrupts, a fully extensible Lua/CSS plugin system, and real-time state telemetry.

Are you ready to move out of the terminal and begin building the React visual frontend?