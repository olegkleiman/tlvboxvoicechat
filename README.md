# TLV Box Voice Chat

## What's it?
Simply put, it's just a wrapper around LLM's streaming simulating voice conversation: User's voice -> s2t -> LLM -> t2s -> Marque.

### 1. User's voice -> s2t

### 2. s2t -> LLM
This part is executed on the server side (Node.js + Express). See '/chat_events' method.
We're going to return the response via SSE, hence we need to stick with GET verb implementation that cann't receive the body.
We solved this challenge with the help of HTTP  session that was established by initial POST method (/init). There are a initial parameters passed and stored in the session.
From within the GET, these parameters are extracted from the session.
The LLM is invoked via Genkit, configured with GoogleAI() and VertexAI plugins. This is a streaming invocation that is resolved as a JS async iterator.
This iterator is enumerated by the for await (...) construct. Each iteration causes the writing SSE chunk

### 2a. SSE
The client JS is getting the produced chunks as .onmessage() calls on created EventSource objects

### 3. t2s -> Marque
