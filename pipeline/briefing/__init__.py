"""
briefing/ — the editorial heart (plan P3): extract → synthesize → verify.

Three stages, each a small module:

  - schema.py     the Appendix G data shapes, as pydantic models with strict validation.
  - extract.py    Stage A: one Haiku call per article via the Message Batches API (submitted in
                  Job A), plus a synchronous fallback for the batch remainder in Job B.
  - synthesize.py Stage B: one synchronous Sonnet call that writes the briefing, structured output.
  - verify.py     the deterministic gate (Appendix E): every number, date, and ticker in the draft
                  must trace back to an extract or the computed stats, or the sentence is flagged.

The LLM narrates; it never computes and never publishes an unverified number. verify.py is what
enforces that promise — deterministically, after generation, regardless of what the model wrote.
"""
