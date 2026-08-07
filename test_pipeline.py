import requests
import time

url = 'http://localhost:8000/upload'
files = {'file': ('sample_reviews.csv', open('sample_reviews.csv', 'rb'), 'text/csv')}
data = {'source': 'play_store', 'team_size': '2_5'}

print('Uploading CSV...')
r = requests.post(url, files=files, data=data)
print('Upload response:', r.status_code, r.json())

session_id = r.json()['session_id']
print(f'Monitoring session {session_id}...')

status_url = f'http://localhost:8000/pipeline/{session_id}/poll'

for _ in range(30):
    time.sleep(2)
    s_res = requests.get(status_url).json()
    status = s_res.get('status')
    step = s_res.get('step')
    progress = s_res.get('progress')
    msg = s_res.get('message')
    print(f'Status: {status} | Step: {step} | Progress: {progress}% | Message: {msg}')
    if status in ['complete', 'failed']:
        break

if status == 'complete':
    print('\nFETCHING DASHBOARD RESULTS:')
    dash = requests.get(f'http://localhost:8000/results/{session_id}/dashboard').json()
    print('Revenue At Risk:', dash.get('revenue_at_risk'))
    print('Top Priority Issue:', dash.get('top_priority_issue', {}).get('issue_key'))
    print('AI Recommendation:', dash.get('ai_recommendation'))
    print('Headline Insights:', dash.get('headline_insights'))
    print('Issues Count:', len(dash.get('issues', [])))

    print('\nFETCHING ROADMAP:')
    road = requests.get(f'http://localhost:8000/results/{session_id}/roadmap').json()
    print('Roadmap Weeks:', len(road.get('roadmap', [])))

    print('\nFETCHING SPRINT:')
    sprint = requests.get(f'http://localhost:8000/results/{session_id}/sprint').json()
    print('Sprint Stories:', len(sprint.get('sprint', {}).get('stories', [])))

    print('\nTESTING AI MEETING Q&A:')
    meet = requests.post(f'http://localhost:8000/meeting/{session_id}/message', json={'message': 'What should I fix first?'}).json()
    print('AI Reply:', meet.get('reply'))
