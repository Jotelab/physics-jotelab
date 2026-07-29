# TikZ Compilation Rate — templated diagrams (DEVELOPMENT_PLAN C4)

Every distinct SUVAT motion-diagram variant (the template is a pure
function of the Given ∪ Find symbol set), compiled with the real TeX
engine (node-tikzjax), no mocks.

| diagram variant | compiled | ms |
| --- | --- | ---: |
| given u,a,t → find v | yes | 2977 |
| given u,a,t → find s | yes | 429 |
| given u,a,s → find v | yes | 395 |
| given u,v,t → find s | yes | 334 |
| given v,a,t → find s | yes | 301 |
| **rate** | **5/5** | |

LLM-generated TikZ is on the cut list; per-model production rates come
from the `[tikz-compile]` logs (`lib/tikz/compilation-log.ts`).
