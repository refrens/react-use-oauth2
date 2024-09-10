import { useEffect } from 'react';
import { OAUTH_RESPONSE } from './constants';
import { channelPostMessage, checkState, isBroadcastChannel, queryToObject } from './tools';

type Props = {
	Component?: React.ReactElement;
};

let didInit = false;

export const OAuthPopup = ({
	Component = (
		<div style={{ margin: '12px' }} data-testid="popup-loading">
			Loading...
		</div>
	),
}: Props) => {
	const channel = new BroadcastChannel('oauth_channel');
	useEffect(() => {
		if (didInit) return;
		didInit = true;

		const payload = {
			...queryToObject(window.location.search.split('?')[1]),
			...queryToObject(window.location.hash.split('#')[1]),
		};
		const state = payload?.state;
		const error = payload?.error;

		if (isBroadcastChannel(channel)) {
			const stateOk = state && checkState(sessionStorage, state);

			if (!error && stateOk) {
				channelPostMessage(channel, { type: OAUTH_RESPONSE, payload });
			} else {
				const errorMessage = error
					? decodeURI(error)
					: `${
							stateOk
								? 'OAuth error: An error has occured.'
								: 'OAuth error: State mismatch.'
						}`;
				channelPostMessage(channel, { type: OAUTH_RESPONSE, error: errorMessage });
			}
		} else {
			throw new Error('No BroadcastChannel support');
		}
	}, []);

	return Component;
};
