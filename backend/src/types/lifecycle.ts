export interface Pingable {
  ping(): Promise<void>;
}

export interface Closable {
  name: string;
  close(): Promise<void>;
}
