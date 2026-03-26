use sysinfo::System;

/// Returns total system RAM in gigabytes, rounded to one decimal place.
#[tauri::command]
pub fn get_ram_gb() -> f64 {
    let mut sys = System::new();
    sys.refresh_memory();
    let bytes = sys.total_memory();
    let gb = bytes as f64 / (1024.0_f64.powi(3));
    (gb * 10.0).round() / 10.0
}

/// Returns currently available RAM in gigabytes, rounded to one decimal place.
///
/// On macOS, sysinfo's `available_memory()` maps to only "free" pages, which
/// is typically 1–2 GB regardless of how much RAM the system really has free.
/// macOS keeps "inactive" pages (recently evicted app memory, file cache) that
/// are immediately reclaimable — this is what Activity Monitor calls "Available".
///
/// We read `vm_stat` directly on macOS to compute:
///   available = (free + inactive + speculative) × page_size
///
/// On Windows/Linux we fall back to sysinfo's `available_memory()`, which is
/// already correct on those platforms.
#[tauri::command]
pub fn get_available_ram_gb() -> f64 {
    let bytes = platform_available_memory_bytes();
    let gb = bytes as f64 / (1024.0_f64.powi(3));
    (gb * 10.0).round() / 10.0
}

// ── Platform implementations ──────────────────────────────────────────────────

/// Shared helper — returns available memory in bytes using the same
/// platform-accurate logic as the `get_available_ram_gb` Tauri command.
/// Call this from other modules instead of reaching into sysinfo directly.
pub fn available_memory_bytes() -> u64 {
    platform_available_memory_bytes()
}

#[cfg(target_os = "macos")]
fn platform_available_memory_bytes() -> u64 {
    macos_available_via_vm_stat().unwrap_or_else(sysinfo_available_bytes)
}

#[cfg(not(target_os = "macos"))]
fn platform_available_memory_bytes() -> u64 {
    sysinfo_available_bytes()
}

fn sysinfo_available_bytes() -> u64 {
    let mut sys = System::new();
    sys.refresh_memory();
    sys.available_memory()
}

/// Parse `vm_stat` output to get Activity-Monitor-accurate available memory.
///
/// vm_stat output looks like:
///   Mach Virtual Memory Statistics: (page size of 16384 bytes)
///   Pages free:                          12345.
///   Pages active:                        67890.
///   Pages inactive:                      11111.
///   Pages speculative:                    2222.
///   ...
///
/// Activity Monitor "Available" = free + inactive + speculative.
#[cfg(target_os = "macos")]
fn macos_available_via_vm_stat() -> Option<u64> {
    use std::process::Command;

    let output = Command::new("vm_stat").output().ok()?;
    let text = String::from_utf8_lossy(&output.stdout);

    // Parse page size from the header line
    let page_size: u64 = text
        .lines()
        .next()?
        .split("page size of ")
        .nth(1)?
        .split_whitespace()
        .next()?
        .parse()
        .ok()?;

    let mut free_pages:        u64 = 0;
    let mut inactive_pages:    u64 = 0;
    let mut speculative_pages: u64 = 0;

    for line in text.lines() {
        let line = line.trim();
        // Values are printed as "12345." — strip the trailing dot
        let parse_val = |s: &str| -> u64 {
            s.trim().trim_end_matches('.').parse().unwrap_or(0)
        };
        if let Some(rest) = line.strip_prefix("Pages free:") {
            free_pages = parse_val(rest);
        } else if let Some(rest) = line.strip_prefix("Pages inactive:") {
            inactive_pages = parse_val(rest);
        } else if let Some(rest) = line.strip_prefix("Pages speculative:") {
            speculative_pages = parse_val(rest);
        }
    }

    Some((free_pages + inactive_pages + speculative_pages) * page_size)
}
