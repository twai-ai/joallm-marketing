// Event system for microservices communication
export interface BaseEvent {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  version: string;
  data: any;
}

export interface UserEvent extends BaseEvent {
  type: 'user.created' | 'user.updated' | 'user.deleted' | 'user.login' | 'user.logout';
  data: {
    userId: string;
    email: string;
    name?: string;
    role?: string;
    metadata?: Record<string, any>;
  };
}

export interface ChatEvent extends BaseEvent {
  type: 'chat.session.created' | 'chat.session.updated' | 'chat.session.deleted' | 'chat.message.sent' | 'chat.message.received';
  data: {
    sessionId: string;
    userId?: string;
    messageId?: string;
    content?: string;
    model?: string;
    metadata?: Record<string, any>;
  };
}

export interface FileEvent extends BaseEvent {
  type: 'file.uploaded' | 'file.processed' | 'file.deleted' | 'file.failed';
  data: {
    fileId: string;
    userId: string;
    filename: string;
    size: number;
    status: string;
    metadata?: Record<string, any>;
  };
}

export interface RAGEvent extends BaseEvent {
  type: 'rag.document.indexed' | 'rag.document.deleted' | 'rag.search.performed' | 'rag.embedding.generated';
  data: {
    documentId?: string;
    userId: string;
    query?: string;
    results?: any[];
    metadata?: Record<string, any>;
  };
}

export interface SystemEvent extends BaseEvent {
  type: 'system.health.check' | 'system.service.up' | 'system.service.down' | 'system.alert';
  data: {
    service: string;
    status: string;
    message?: string;
    metadata?: Record<string, any>;
  };
}

export type Event = UserEvent | ChatEvent | FileEvent | RAGEvent | SystemEvent;

// Event handlers
export interface EventHandler<T extends Event = Event> {
  handle(event: T): Promise<void>;
}

// Event publisher interface
export interface EventPublisher {
  publish(event: Event): Promise<void>;
  publishBatch(events: Event[]): Promise<void>;
}

// Event subscriber interface
export interface EventSubscriber {
  subscribe<T extends Event>(eventType: string, handler: EventHandler<T>): Promise<void>;
  unsubscribe(eventType: string, handler: EventHandler): Promise<void>;
}

// Event bus interface
export interface EventBus extends EventPublisher, EventSubscriber {
  start(): Promise<void>;
  stop(): Promise<void>;
  isHealthy(): Promise<boolean>;
}

// Event store interface for persistence
export interface EventStore {
  save(event: Event): Promise<void>;
  getEvents(filter: {
    type?: string;
    source?: string;
    from?: Date;
    to?: Date;
    limit?: number;
    offset?: number;
  }): Promise<Event[]>;
  getEventById(id: string): Promise<Event | null>;
}

// Event replay interface
export interface EventReplay {
  replayEvents(filter: {
    type?: string;
    source?: string;
    from?: Date;
    to?: Date;
  }): Promise<void>;
}

// Event validation
export function validateEvent(event: any): event is Event {
  return (
    event &&
    typeof event.id === 'string' &&
    typeof event.type === 'string' &&
    typeof event.timestamp === 'string' &&
    typeof event.source === 'string' &&
    typeof event.version === 'string' &&
    typeof event.data === 'object'
  );
}

// Event factory
export class EventFactory {
  static createEvent<T extends Event>(
    type: T['type'],
    source: string,
    data: T['data'],
    version: string = '1.0.0'
  ): T {
    return {
      id: crypto.randomUUID(),
      type,
      timestamp: new Date().toISOString(),
      source,
      version,
      data
    } as T;
  }

  static createUserEvent(
    type: UserEvent['type'],
    source: string,
    data: UserEvent['data']
  ): UserEvent {
    return this.createEvent(type, source, data);
  }

  static createChatEvent(
    type: ChatEvent['type'],
    source: string,
    data: ChatEvent['data']
  ): ChatEvent {
    return this.createEvent(type, source, data);
  }

  static createFileEvent(
    type: FileEvent['type'],
    source: string,
    data: FileEvent['data']
  ): FileEvent {
    return this.createEvent(type, source, data);
  }

  static createRAGEvent(
    type: RAGEvent['type'],
    source: string,
    data: RAGEvent['data']
  ): RAGEvent {
    return this.createEvent(type, source, data);
  }

  static createSystemEvent(
    type: SystemEvent['type'],
    source: string,
    data: SystemEvent['data']
  ): SystemEvent {
    return this.createEvent(type, source, data);
  }
}

