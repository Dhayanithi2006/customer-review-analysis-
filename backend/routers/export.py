"""
Export Router — CSV sprint + Markdown roadmap downloads
"""
import csv
import io
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse, PlainTextResponse
from database import get_db

router = APIRouter(prefix="/export", tags=["export"])


@router.get("/{session_id}/sprint")
def export_sprint_csv(session_id: str):
    db = get_db()
    outputs = db.table("session_outputs").select("sprint_json").eq("session_id", session_id).single().execute().data

    if not outputs or not outputs.get("sprint_json"):
        raise HTTPException(404, "Sprint not generated")

    sprint = outputs["sprint_json"]
    stories = sprint.get("stories", [])

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=[
        "id", "title", "user_story", "acceptance_criteria",
        "effort", "story_points", "priority", "linked_issue"
    ])
    writer.writeheader()

    for s in stories:
        writer.writerow({
            "id":                  s.get("id", ""),
            "title":               s.get("title", ""),
            "user_story":          s.get("user_story", ""),
            "acceptance_criteria": " | ".join(s.get("acceptance_criteria", [])),
            "effort":              s.get("effort", ""),
            "story_points":        s.get("story_points", ""),
            "priority":            s.get("priority", ""),
            "linked_issue":        s.get("linked_issue", ""),
        })

    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=sprint_{session_id[:8]}.csv"},
    )


@router.get("/{session_id}/roadmap")
def export_roadmap_markdown(session_id: str):
    db = get_db()
    outputs = db.table("session_outputs").select("roadmap_json").eq("session_id", session_id).single().execute().data

    if not outputs or not outputs.get("roadmap_json"):
        raise HTTPException(404, "Roadmap not generated")

    roadmap = outputs["roadmap_json"]
    lines = ["# Product Roadmap\n"]

    for week in roadmap:
        lines.append(f"## Week {week['week']} — {week['theme']}")
        lines.append(f"**Effort**: {week.get('effort', '')}")
        lines.append(f"**Issues**: {', '.join(week.get('issues', []))}")
        lines.append(f"**Rationale**: {week.get('rationale', '')}")
        lines.append("")

    return PlainTextResponse(
        "\n".join(lines),
        headers={"Content-Disposition": f"attachment; filename=roadmap_{session_id[:8]}.md"},
    )
