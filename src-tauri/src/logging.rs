use log::{LevelFilter, Metadata, Record};
use std::sync::atomic::{AtomicUsize, Ordering};

static LOGGER: AppLogger = AppLogger {
    level: AtomicUsize::new(LevelFilter::Info as usize),
};

pub fn init(default_level: LevelFilter) {
    LOGGER.set_level(default_level);
    if log::set_logger(&LOGGER).is_ok() {
        log::set_max_level(default_level);
    }
}

pub fn set_level(level: LevelFilter) {
    LOGGER.set_level(level);
    log::set_max_level(level);
}

struct AppLogger {
    level: AtomicUsize,
}

impl AppLogger {
    fn current_level(&self) -> LevelFilter {
        match self.level.load(Ordering::Relaxed) {
            0 => LevelFilter::Off,
            1 => LevelFilter::Error,
            2 => LevelFilter::Warn,
            3 => LevelFilter::Info,
            4 => LevelFilter::Debug,
            _ => LevelFilter::Trace,
        }
    }

    fn set_level(&self, level: LevelFilter) {
        let value = match level {
            LevelFilter::Off => 0,
            LevelFilter::Error => 1,
            LevelFilter::Warn => 2,
            LevelFilter::Info => 3,
            LevelFilter::Debug => 4,
            LevelFilter::Trace => 5,
        };
        self.level.store(value, Ordering::Relaxed);
    }
}

impl log::Log for AppLogger {
    fn enabled(&self, metadata: &Metadata) -> bool {
        metadata.level().to_level_filter() <= self.current_level()
    }

    fn log(&self, record: &Record) {
        if self.enabled(record.metadata()) {
            println!("[{}] {}", record.level(), record.args());
        }
    }

    fn flush(&self) {}
}

#[cfg(test)]
mod tests {
    use super::*;
    use log::{Level, Log};

    #[test]
    fn updates_log_level() {
        init(LevelFilter::Error);
        set_level(LevelFilter::Debug);
        assert!(LOGGER.enabled(&Metadata::builder().level(Level::Debug).build()));
    }
}
