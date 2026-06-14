0:00 Hello, I am Abhinash Bihra and this is my mini CRM platform. And the problem I chose was to solve, uh, small business owners have valuable customer data but lack, uh, technical expertise that they, uh, to manually query segments and time and they don't have time and so that's why I built an AI-native CRM that bridges this gap. It allows users to manage their customer database but more importantly it features an intelligent AI assistant that can, like, dynamically query the database to build customer segments and it can also instantly draft highly personalized marketing campaigns or messages and segments . 

0:42 So let us look at our project. This is the dashboard here. It is interactive dashboard. We can see, uh, what are the campaigns, uh, send, engagement funnel, recent campaigns, total revenue, average delivery rate, etc.

0:58 This is the customers. All of the 500 seeded customers are here. We can click on the customer. Customers to see what they ordered, what they spend, their details, etc.

1:09 This is the segment of inactive customers, highly valued customers, etc. We can use this to create, uh, or create, uh, new campaigns.

1:20 And, uh, this is campaign, we'll go to this later. This is the AIZ specifically. This can be used to automate the process of, uh, campaigning, uh, you, making segments, campaigns, dashboards, customers, everything.

1:33 So, basically, if I send this. The AI will automatically make things, uh, for me. And so, it is an agentic, uh, AI, uh, integrated thing.

1:45 And now, we can send it to, uh, 397 customers. As you can see, in campaigns, I've already done it. And it's delivering right now.

1:52 I've used Redis for this. I've tried on different types of campaigns. And, uh, as you can see, 94% delivery, 90% delivery, etc.

2:02 When, uh, we click one of them, we can view it. See, 71 sent, uh, 64 delivered, 45 opened, the gate read, 7 failed, here are all the details.

2:14 Basically, AIChat is one of the most important things here, it automates everything. It automates finds from database as well as sends campaigns, makes segments that can and makes things easier for a marketeer.

2:29 Now, let us look at the technical architecture. This is the flowchart. Like, Click. Like I have used, this is a full-stack application built with a React frontend and a Node.js backend using PostgreSQL and Prisma for data modeling.

2:50 To ensure the data system scales, I decoupled the message sending from a web request using an asynchronous job queue that is powered by, like, BoolMQ and Redis.

3:00 This prevents the server from timing out when sending thousands of messages. I also built a microservice-style channel stub. It acts as a mock third-party delivery provider.

3:10 My worker sends a message to the stub and the stub, like, asynchronously files webworks back to my CRM. This mirrors real-world APIs like Twilio, etc.

3:20 As you can see, the marketer sends into frontend and then it passes to backend, we can see growth. LLM, which is used for the AI chat, and this is BoolMQ Redis.

3:32 This is passed to the background delivery workers that mock, that uses the channel stub to mock WhatsApp SMS provider and the delivery receipts are sent to backend webbook API, which then gives it to customers.

3:43 PostgreSQL. Now, so this is how it works, and this is the frontend where we can see it, and let us look at the code.

3:54 So, this is AIService.ts, like, this is responsible, this for the AI integration, I used the Grok API with tool calling.

4:02 So, basically, AI decides what tool it has to call. I provide the LLM with a schema describing my database, like, allowing it to autonomously execute functions like create segment with complex logic.

4:14 So, it's pretty basically agentic AI, which chooses what it has to do. The model is LLAMA, 3.370 billion parameters. And then, let us go to the BoolMQ code.

4:30 Here is the code for BoolMQ. This is the, uh, BoolMQ worker. It pulls jobs off the Redis queue, injects the user-specific data into the AI's template, and, like, posts to the delivery API.

4:42 Like the exploit rate limiting and sleep logic here, I implemented this to handle four tasks. Code 29, too many requests, this was coming, uh, constantly when I was trying to, uhm, send data.

4:52 This was done to protect third-party API from TDOS. And let us look at the, one second. Let us look at the web, Webhooks code.

5:07 This is the code. And finally, this is the Webhook receiver code. It catches the async delivery events from the provider and uses that Prisma to efficiently update the, uh, uh, recipient status in the database.

5:19 Like, it powers that real-time funnel we saw earlier. This one. This engagement funnel, it is powered by that Webhook. And how I integrated AI native workflow.

5:31 Like, AI wasn't just a feature of this product. It was a fundamental to how I built it. I used an advanced AI coding assistant throughout the entire cycle of this project.

5:42 Like, we collaborated on the initial post-SQL, SQL schema design, and I used that AI assistant. I used AI to rapidly iterate on the React UI components like the engagement funnel.

5:52 Most importantly, I leveraged AI for deep debugging. The debugging on this project was crucial. It had lots of bugs, uh, both locally and while both on deploying as well as locally.

6:04 And, uh, when my background worker was overwhelming the render-free DR firewall and causing DNS issue, I used AI to analyze that.

6:12 And then also to analyze the pool MQ, pool MQQ state in real time, like diagnose the network bottleneck, implement the manual debugging.

6:20 It acted as a complex debugger and helped me to solve this project.
