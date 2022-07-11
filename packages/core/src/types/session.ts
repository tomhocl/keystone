import type { ServerResponse, IncomingMessage } from 'http';
import type { JSONValue } from './utils';
import { CreateContext } from '.';

export type SessionStrategy<SessionData, StartSessionData = never> = {
  // this function should create a new session, and return any relevant data
  start: (args: {
    res: ServerResponse;
    data: StartSessionData;
    createContext: CreateContext;
  }) => Promise<string>; // TODO: change to T

  // this populates the session object
  get: (args: {
    req: IncomingMessage;
    createContext: CreateContext;
  }) => Promise<SessionData | undefined>;

  // this function should end the session, by whatever means
  end: (args: {
    req: IncomingMessage;
    res: ServerResponse;
//      data?: StoredSessionData; // TODO: add
    createContext: CreateContext;
  }) => Promise<void>; // TODO: change to T2 = void

  disconnect?: () => Promise<void>; // TODO: remove
};

export type SessionStore = {
  connect?: () => Promise<void>;
  disconnect?: () => Promise<void>;
  get(key: string): undefined | JSONValue | Promise<JSONValue | undefined>;
  // 😞 using any here rather than void to be compatible with Map. note that `| Promise<void>` doesn't actually do anything type wise because it just turns into any, it's just to show intent here
  set(key: string, value: JSONValue): any | Promise<void>;
  // 😞 | boolean is for compatibility with Map
  delete(key: string): void | boolean | Promise<void>;
};

export type SessionStoreFunction = (args: {
  /**
   * The number of seconds that a cookie session be valid for
   */
  maxAge: number;
}) => SessionStore;
