# Marketing Runtime v2

Project You+ marketing execution uses three concurrent agent lanes per owner. Agent work must never rely on a single global lock. Runs older than five minutes in `queued` or `running` are considered stale and are automatically failed by the database admission guard.

Provider generation is represented separately in `marketing_generation_jobs`. Agent runs should finish after they submit or enqueue provider work; long-running image/video rendering must not hold an agent execution lane.

Content flow:

1. Atlas creates one idempotent morning plan per America/New_York day after 6 AM.
2. Frame, Signal and Muse may work concurrently when dependencies allow.
3. Higgsfield generation is tracked in `marketing_generation_jobs` and runs on its own provider heartbeat.
4. Muse performs one quality gate after an asset exists.
5. Owner approves.
6. Instagram publishes approved, due media on its own publishing heartbeat.
7. Vector records post-performance learning.

The background runtime uses separate secured heartbeats for planning, OpenAI agent work, Higgsfield provider work and Instagram publishing so one slow dependency cannot block the rest of the department.

Static posts should use the shortest path possible. The default daily mix is static/editorial, carousel and story content. Reels are selective and normally capped at one new Reel in a rolling seven-day production window. Reels use premium motion typography and real Project You+ UI rather than fake UGC or AI talking-head advertising. Revision loops are bounded to one automatic correction pass before owner review.
