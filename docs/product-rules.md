# MyRank product rules

## Self-vote is the core loop

Users may vote **unlimited** times on:

- Their own profile total score (TP) via profile ↑/↓
- Their own posts
- Their own stories

Self-vote is **allowed and intentional**, not an abuse case.

### API implications

- No `assertNotSelfVote` guard on vote batch engines.
- Profile self-vote (`targetUserId === actorId`) skips per-minute vote rate limiting.
- Other vote batches use a high default cap (`API_VOTE_RATE_LIMIT_PER_MINUTE`, default 1200/min).
