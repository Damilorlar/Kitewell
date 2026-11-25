//! Decide whether a caller is registering for the first time.
//!
//! A later call keeps the original registration instead of replacing it.

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct Registration {
    pub at: u64,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Decision {
    Created(Registration),
    Idempotent(Registration),
}

pub fn decide(existing: Option<Registration>, now: u64) -> Decision {
    match existing {
        Some(existing) => Decision::Idempotent(existing),
        None => Decision::Created(Registration { at: now }),
    }
}
