# Marketing Runtime v2

Project You+ marketing execution uses three concurrent agent lanes per owner. Agent work must never rely on a single global lock. Runs older than five minutes in `queued` or `running` are considered stale and are automatically failed by the database admission guard.

Provider generation is represented separately in `marketing_generation_jobs`. Agent runs should finish after they submit or enqueue provider work; long-running image/video rendering must not hold an agent execution lane.

Content flow:

1. Atlas/Northstar create prioritized briefs.
2. Frame, Signal and Muse may work concurrently when dependencies allow.
3. Higgsfield generation is tracked in `marketing_generation_jobs`.
4. Muse performs one quality gate after an asset exists.
5. Owner approves.
6. Instagram publishes approved media.
7. Vector records post-performance learning.

Static posts should use the shortest path possible (Signal + Muse, then owner approval). Reels may use Frame + Signal in parallel, followed by Muse and provider generation. Revision loops must be bounded to one automatic correction pass before owner review.
