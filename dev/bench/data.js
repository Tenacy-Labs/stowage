window.BENCHMARK_DATA = {
  "lastUpdate": 1788034787670,
  "repoUrl": "https://github.com/Tenacy-Labs/stowage",
  "entries": {
    "relief-dp": [
      {
        "commit": {
          "author": {
            "email": "robottwo@users.noreply.github.com",
            "name": "Daniel Eisner",
            "username": "robottwo"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "2a500bb1602e50228233b1b7da47b4869f62f2f2",
          "message": "Merge pull request #9 from Tenacy-Labs/ci/observability\n\nci: junit artifacts + Check Run, lcov coverage summary, bench tracking",
          "timestamp": "2026-08-29T16:10:18-04:00",
          "tree_id": "7ece46078b5c6e20fa0417f10d404765a37c377e",
          "url": "https://github.com/Tenacy-Labs/stowage/commit/2a500bb1602e50228233b1b7da47b4869f62f2f2"
        },
        "date": 1788034231130,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "relief-dp win-4k (n=40, budget=4000)",
            "value": 1.597,
            "unit": "ms",
            "extra": "med 1.639 ms over 3 reps"
          },
          {
            "name": "relief-dp win-30k (n=300, budget=30000)",
            "value": 13.721,
            "unit": "ms",
            "extra": "med 15.245 ms over 3 reps"
          },
          {
            "name": "relief-dp win-200k (n=500, budget=200000)",
            "value": 2.124,
            "unit": "ms",
            "extra": "med 2.871 ms over 3 reps"
          },
          {
            "name": "relief-dp win-1M (n=1000, budget=1000000)",
            "value": 2.172,
            "unit": "ms",
            "extra": "med 2.306 ms over 3 reps"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "robottwo@users.noreply.github.com",
            "name": "Daniel Eisner",
            "username": "robottwo"
          },
          "committer": {
            "email": "noreply@github.com",
            "name": "GitHub",
            "username": "web-flow"
          },
          "distinct": true,
          "id": "ff88976d2472dca5e624daf14268e828928e8f6a",
          "message": "Merge pull request #10 from Tenacy-Labs/ci/coverage-gate\n\nci: coverage gate — ratchet on total, 80% floor on new src/ lines",
          "timestamp": "2026-08-29T16:19:37-04:00",
          "tree_id": "d46a38c78d1d54b070d4af8f912efd386564b3a3",
          "url": "https://github.com/Tenacy-Labs/stowage/commit/ff88976d2472dca5e624daf14268e828928e8f6a"
        },
        "date": 1788034787185,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "relief-dp win-4k (n=40, budget=4000)",
            "value": 1.941,
            "unit": "ms",
            "extra": "med 2.167 ms over 3 reps"
          },
          {
            "name": "relief-dp win-30k (n=300, budget=30000)",
            "value": 16.566,
            "unit": "ms",
            "extra": "med 19.887 ms over 3 reps"
          },
          {
            "name": "relief-dp win-200k (n=500, budget=200000)",
            "value": 2.574,
            "unit": "ms",
            "extra": "med 2.653 ms over 3 reps"
          },
          {
            "name": "relief-dp win-1M (n=1000, budget=1000000)",
            "value": 2.955,
            "unit": "ms",
            "extra": "med 3.215 ms over 3 reps"
          }
        ]
      }
    ]
  }
}