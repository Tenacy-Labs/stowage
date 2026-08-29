window.BENCHMARK_DATA = {
  "lastUpdate": 1788037424583,
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
          "id": "bc5498fb89a4d6a152c428d8c6d899ceda5d4746",
          "message": "Merge pull request #11 from Tenacy-Labs/ci/e2e-stage\n\nci: e2e stage — pack artifact, consume in scratch project",
          "timestamp": "2026-08-29T16:27:55-04:00",
          "tree_id": "48503c5ef4f76af048114cf294994b3d38ed5f3e",
          "url": "https://github.com/Tenacy-Labs/stowage/commit/bc5498fb89a4d6a152c428d8c6d899ceda5d4746"
        },
        "date": 1788035287525,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "relief-dp win-4k (n=40, budget=4000)",
            "value": 1.347,
            "unit": "ms",
            "extra": "med 1.904 ms over 3 reps"
          },
          {
            "name": "relief-dp win-30k (n=300, budget=30000)",
            "value": 10.321,
            "unit": "ms",
            "extra": "med 12.002 ms over 3 reps"
          },
          {
            "name": "relief-dp win-200k (n=500, budget=200000)",
            "value": 1.655,
            "unit": "ms",
            "extra": "med 1.740 ms over 3 reps"
          },
          {
            "name": "relief-dp win-1M (n=1000, budget=1000000)",
            "value": 1.102,
            "unit": "ms",
            "extra": "med 1.126 ms over 3 reps"
          }
        ]
      },
      {
        "commit": {
          "author": {
            "email": "robottwo@gmail.com",
            "name": "Daniel Eisner",
            "username": "robottwo"
          },
          "committer": {
            "email": "robottwo@gmail.com",
            "name": "Daniel Eisner",
            "username": "robottwo"
          },
          "distinct": true,
          "id": "dba87afd84e87f2b2be663c65874526b14e4b2cc",
          "message": "feat: virtual head block in CacheModel — tool-def prefix tokens ride the believed chain\n\nProviders render tool definitions as a prefix before the system prompt:\ntokens present in every request and part of the provider-side cache chain,\nbut outside stowage's render blocks. setHeadBlock() installs that\nprobe-measured prefix as a virtual block at position 0:\n\n- rides both sides of expectedHit (re-sent verbatim, always self-matches);\n- freshness advances with update() (turn clock only — tool defs never\n  realistically age out);\n- virtual only: believedChain() stays head-free; calibrate() untouched —\n  head tokens flow through classification via expectedHit as before;\n- setHeadBlock(null) restores plain block-prefix semantics.\n\nAdditive API; no-head behavior is bit-identical (full prior suite green\nunchanged). Includes the two ported invariant tests from tenacy's\nproduction-tested vendored copy.",
          "timestamp": "2026-08-29T16:33:24-04:00",
          "tree_id": "f9ec4c0b4c92d4d400954817831dca0d79a14bdc",
          "url": "https://github.com/Tenacy-Labs/stowage/commit/dba87afd84e87f2b2be663c65874526b14e4b2cc"
        },
        "date": 1788035720819,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "relief-dp win-4k (n=40, budget=4000)",
            "value": 1.963,
            "unit": "ms",
            "extra": "med 2.102 ms over 3 reps"
          },
          {
            "name": "relief-dp win-30k (n=300, budget=30000)",
            "value": 15.955,
            "unit": "ms",
            "extra": "med 19.412 ms over 3 reps"
          },
          {
            "name": "relief-dp win-200k (n=500, budget=200000)",
            "value": 2.584,
            "unit": "ms",
            "extra": "med 2.920 ms over 3 reps"
          },
          {
            "name": "relief-dp win-1M (n=1000, budget=1000000)",
            "value": 2.755,
            "unit": "ms",
            "extra": "med 3.016 ms over 3 reps"
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
          "id": "3320a28b929e9a217148dc4dde6dfee5413f8a90",
          "message": "Merge pull request #12 from Tenacy-Labs/feat/head-block-getter\n\nfeat: CacheModel.headBlock() — symmetric getter for the installed head",
          "timestamp": "2026-08-29T16:49:09-04:00",
          "tree_id": "a52db586b1963ba24a558f3ce4d8c4c1dff9025a",
          "url": "https://github.com/Tenacy-Labs/stowage/commit/3320a28b929e9a217148dc4dde6dfee5413f8a90"
        },
        "date": 1788036557489,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "relief-dp win-4k (n=40, budget=4000)",
            "value": 1.66,
            "unit": "ms",
            "extra": "med 1.857 ms over 3 reps"
          },
          {
            "name": "relief-dp win-30k (n=300, budget=30000)",
            "value": 13.492,
            "unit": "ms",
            "extra": "med 15.210 ms over 3 reps"
          },
          {
            "name": "relief-dp win-200k (n=500, budget=200000)",
            "value": 2.405,
            "unit": "ms",
            "extra": "med 2.482 ms over 3 reps"
          },
          {
            "name": "relief-dp win-1M (n=1000, budget=1000000)",
            "value": 2.161,
            "unit": "ms",
            "extra": "med 2.203 ms over 3 reps"
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
          "id": "f17bb43e8d68b9f25d3cd6b5147d8b41a2d263e4",
          "message": "Merge pull request #14 from Tenacy-Labs/test/evidence-invariants\n\ntest: evidence module invariants — λ posterior, factor clamps, Beta variance guards",
          "timestamp": "2026-08-29T16:53:28-04:00",
          "tree_id": "15478c41e51ecf739fa74f9dd5637c4a5a8896c0",
          "url": "https://github.com/Tenacy-Labs/stowage/commit/f17bb43e8d68b9f25d3cd6b5147d8b41a2d263e4"
        },
        "date": 1788036820760,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "relief-dp win-4k (n=40, budget=4000)",
            "value": 1.463,
            "unit": "ms",
            "extra": "med 1.970 ms over 3 reps"
          },
          {
            "name": "relief-dp win-30k (n=300, budget=30000)",
            "value": 14.9,
            "unit": "ms",
            "extra": "med 17.453 ms over 3 reps"
          },
          {
            "name": "relief-dp win-200k (n=500, budget=200000)",
            "value": 2.101,
            "unit": "ms",
            "extra": "med 2.319 ms over 3 reps"
          },
          {
            "name": "relief-dp win-1M (n=1000, budget=1000000)",
            "value": 2.555,
            "unit": "ms",
            "extra": "med 2.770 ms over 3 reps"
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
          "id": "a875897aeba72e0ddda368d6dd77497895e1fbdb",
          "message": "Merge pull request #13 from Tenacy-Labs/release-please--branches--main--components--stowage\n\nchore(main): release 0.3.0",
          "timestamp": "2026-08-29T16:55:03-04:00",
          "tree_id": "7f5423d37c55802d4a7232328646e145c0fc9123",
          "url": "https://github.com/Tenacy-Labs/stowage/commit/a875897aeba72e0ddda368d6dd77497895e1fbdb"
        },
        "date": 1788036913089,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "relief-dp win-4k (n=40, budget=4000)",
            "value": 1.923,
            "unit": "ms",
            "extra": "med 2.009 ms over 3 reps"
          },
          {
            "name": "relief-dp win-30k (n=300, budget=30000)",
            "value": 12.303,
            "unit": "ms",
            "extra": "med 14.365 ms over 3 reps"
          },
          {
            "name": "relief-dp win-200k (n=500, budget=200000)",
            "value": 2.155,
            "unit": "ms",
            "extra": "med 2.276 ms over 3 reps"
          },
          {
            "name": "relief-dp win-1M (n=1000, budget=1000000)",
            "value": 1.998,
            "unit": "ms",
            "extra": "med 2.442 ms over 3 reps"
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
          "id": "8407519f86f62f90e17da9dc7f29e80fae3928f6",
          "message": "Merge pull request #15 from Tenacy-Labs/docs/gates-note\n\ndocs: required checks + auto-merge on main",
          "timestamp": "2026-08-29T17:03:31-04:00",
          "tree_id": "12fdd7e6ed5aa5cef1b0be8e739e6ab0b5cd1483",
          "url": "https://github.com/Tenacy-Labs/stowage/commit/8407519f86f62f90e17da9dc7f29e80fae3928f6"
        },
        "date": 1788037423764,
        "tool": "customSmallerIsBetter",
        "benches": [
          {
            "name": "relief-dp win-4k (n=40, budget=4000)",
            "value": 1.324,
            "unit": "ms",
            "extra": "med 1.389 ms over 3 reps"
          },
          {
            "name": "relief-dp win-30k (n=300, budget=30000)",
            "value": 9.573,
            "unit": "ms",
            "extra": "med 11.370 ms over 3 reps"
          },
          {
            "name": "relief-dp win-200k (n=500, budget=200000)",
            "value": 1.692,
            "unit": "ms",
            "extra": "med 1.919 ms over 3 reps"
          },
          {
            "name": "relief-dp win-1M (n=1000, budget=1000000)",
            "value": 1.349,
            "unit": "ms",
            "extra": "med 1.427 ms over 3 reps"
          }
        ]
      }
    ]
  }
}