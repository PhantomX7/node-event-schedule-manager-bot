import os, sys

if not os.path.isfile('./.env'):
    print ('.env file doesn\'t exist')
    sys.exit(0)

env_file = open('.env', 'r') 
lines = list(
    filter(
        lambda e: len(e) > 0, 
        map(
            lambda e: e.strip(), 
            env_file.readlines()
        )
    )
)

cnt = 0

for line in lines:
    equal_index = line.index('=')
    env_key = line[:equal_index]
    env_value = line[equal_index + 1:]
    try:
        os.system(f'heroku config:set {env_key}={env_value}')
        print(f'Successfully set {env_key}')
        cnt += 1
    except:
        print(f'Failed to set {env_key}')

print ()
print (f'Total: {len(lines)}, Success: {cnt}, Fail: {len(lines) - cnt}')
print ()
