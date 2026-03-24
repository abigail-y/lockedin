## Transcript Highlights

### 1. Planning
This is what I asked Claude after it gave me a simple schema. 

"Yes. and before any code, the features my website will include are a home     
dashboard that'll include the users stats, a tracked study session that allows  
the user to log in for a session like a focus mode built in the website, a      
pomodoro timer, a calendar to plan and view assignments and deadlines, a        
deadline tracker, and a flash card section to make and review. While coding, go 
 by each feature and page one by one. Front end will be html css javascript and 
 backend with node.js, and if a database is needed MongoDB. When generating     
code, explain the file structure and generate code step-by-step.We'll do        
everything one by one and keep everything organized."
I like being very specific from the start so it's easier to go step-by-step and have less problems with the code 

### 2. Customizing 
  Ready for Step 4 — Pomodoro Timer (pages/pomodoro.html, css/pomodoro.css,
  js/pomodoro.js)?
✻ Baked for 4m 17s
> Can you have a button to minimize the sessions timer and still have it show   
in the corner, and keep the dark more throughout the whole website while the    
user is in a study session. 
After checking the code I wanted it to have a different UI so I asked Claude to make specific changes to have dashboard be more accessible during the session timer. 

### 3. Keeping it simple. 
I realized after each feature Claude would take over five minutes to complete the pages so I made sure to use simpler code to be cleaner. ✻ Baked for 5m 40s

> Yes. Keep the solution minimal. Have CRUD routes for assignments, have        
userID, title, dueDate, priority(three levels), status. A form of title, due    
date, priority. Display the assignments lists with complete button and have it  
strikethrough. Add filter by status and sort by due date.    