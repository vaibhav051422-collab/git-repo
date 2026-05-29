from pipeline.retriever import answer_query
import traceback

print('Invoking answer_query...')
try:
    res = answer_query(query='hello', repo_id='test', history=[], top_k=3, provider='openai', api_key=None)
    print('Result:', res)
except Exception as e:
    traceback.print_exc()
    print('\nException type:', type(e))
    print('Exception repr:', repr(e))
