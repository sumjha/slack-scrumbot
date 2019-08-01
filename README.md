# slack-scrumbot
> A [Slack](https://www.slack.com/) bot that performs a scrum pre-standup checkin.

## Installation
```bash
$ npm install
```

## Usage
Add a bot in Slack's **Integrations** panel. Copy the token.

#### Configure
```bash
export SCRUMBOT_TOKEN=your_slack_token
export TIME=Time in UTC eg. (9:40) for auto scrum start
export SCRUM_USERS="space seperated userids"
export CHANNEL_ID=Slack channel id

```

#### Start bot
```bash
npm start
```
Invite the bot to a channel:
```
/invite @botname
```

#### Start/Stop a scrum manually
```
@botname: scrum
```
```
@botname: stop
```

#### Stop bot
```bash
$ npm stop
```
