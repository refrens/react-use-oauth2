import { useCallback, useRef, useState } from 'react';
import useLocalStorageState from 'use-local-storage-state';
import {
	DEFAULT_EXCHANGE_CODE_FOR_TOKEN_METHOD,
	OAUTH_RESPONSE,
	OAUTH_RESPONSE_ACK,
} from './constants';
import {
	channelPostMessage,
	cleanupChannel,
	formatAuthorizeUrl,
	formatExchangeCodeForTokenServerURL,
	generateState,
	openPopup,
	saveState,
} from './tools';
import { TAuthTokenPayload, TMessageData, TOauth2Props, TState } from './types';
import { useCheckProps } from './use-check-props';

export const useOAuth2 = <TData = TAuthTokenPayload>(props: TOauth2Props<TData>) => {
	const {
		authorizeUrl,
		clientId,
		redirectUri,
		scope = '',
		responseType,
		extraQueryParameters = {},
		onSuccess,
		onError,
	} = props;

	useCheckProps<TData>(props);
	const extraQueryParametersRef = useRef(extraQueryParameters);
	const popupRef = useRef<Window | null>();
	const intervalRef = useRef<string | number | NodeJS.Timeout | undefined>();
	const exchangeCodeForTokenQueryRef = useRef(
		responseType === 'code' && props.exchangeCodeForTokenQuery
	);
	const exchangeCodeForTokenQueryFnRef = useRef(
		responseType === 'code' && props.exchangeCodeForTokenQueryFn
	);
	const [{ loading, error }, setUI] = useState<{ loading: boolean; error: string | null }>({
		loading: false,
		error: null,
	});
	const [data, setData, { removeItem, isPersistent }] = useLocalStorageState<TState<TData>>(
		`${responseType}-${authorizeUrl}-${clientId}-${scope}`,
		{
			defaultValue: null,
		}
	);

	const channel = useRef(new BroadcastChannel('refrens_oauth_channel'));

	const getAuth = useCallback(() => {
		// 1. Init
		setUI({
			loading: true,
			error: null,
		});

		// 2. Generate and save state
		const state = generateState();
		saveState(sessionStorage, state);

		// 3. Open popup
		popupRef.current = openPopup(
			formatAuthorizeUrl(
				authorizeUrl,
				clientId,
				redirectUri,
				scope,
				state,
				responseType,
				extraQueryParametersRef.current
			)
		);

		// 4. Register message listener
		async function handleBroadcastChannelMessage(message: MessageEvent<TMessageData>) {
			const type = message?.data?.type;
			if (type !== OAUTH_RESPONSE) {
				return;
			}
			try {
				if ('error' in message.data) {
					const errorMessage = message.data?.error || 'Unknown Error occured.';
					setUI({
						loading: false,
						error: errorMessage,
					});
					if (onError) await onError(errorMessage);
				} else {
					let payload = message?.data?.payload;

					if (responseType === 'code') {
						const exchangeCodeForTokenQueryFn = exchangeCodeForTokenQueryFnRef.current;
						const exchangeCodeForTokenQuery = exchangeCodeForTokenQueryRef.current;
						if (
							exchangeCodeForTokenQueryFn &&
							typeof exchangeCodeForTokenQueryFn === 'function'
						) {
							payload = await exchangeCodeForTokenQueryFn(message.data?.payload);
						} else if (exchangeCodeForTokenQuery) {
							const response = await fetch(
								formatExchangeCodeForTokenServerURL(
									exchangeCodeForTokenQuery.url,
									clientId,
									payload?.code,
									redirectUri,
									state
								),
								{
									method:
										exchangeCodeForTokenQuery.method ??
										DEFAULT_EXCHANGE_CODE_FOR_TOKEN_METHOD,
									headers: exchangeCodeForTokenQuery.headers || {},
								}
							);
							payload = await response.json();
						} else {
							throw new Error(
								'useOAuth2: You must provide `exchangeCodeForTokenQuery` or `exchangeCodeForTokenQueryFn`'
							);
						}
					}

					setUI({
						loading: false,
						error: null,
					});
					setData(payload);
					if (onSuccess) {
						await onSuccess(payload);
					}
				}
			} catch (genericError: any) {
				console.error(genericError);
				setUI({
					loading: false,
					error: genericError.toString(),
				});
				if (onError) await onError(genericError.toString());
			} finally {
				// Clear stuff ...
				channelPostMessage(channel.current, { type: OAUTH_RESPONSE_ACK, payload: 'ack' });
				cleanupChannel(
					intervalRef,
					popupRef,
					channel.current,
					handleBroadcastChannelMessage
				);
			}
		}
		// eslint-disable-next-line unicorn/prefer-add-event-listener
		channel.current.addEventListener('message', handleBroadcastChannelMessage);

		// 5. Remove listener(s) on unmount
		return () => {
			// eslint-disable-next-line unicorn/prefer-add-event-listener
			channel.current.close();
			channel.current.removeEventListener('message', handleBroadcastChannelMessage);
			if (intervalRef.current) clearInterval(intervalRef.current);
		};
	}, [
		authorizeUrl,
		clientId,
		redirectUri,
		scope,
		responseType,
		onSuccess,
		onError,
		setUI,
		setData,
		channel,
	]);

	const logout = useCallback(() => {
		removeItem();
		setUI({ loading: false, error: null });
	}, [removeItem]);

	return { data, loading, error, getAuth, logout, isPersistent };
};
