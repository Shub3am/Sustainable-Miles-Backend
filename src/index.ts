import { Context, Hono } from 'hono'
import { cors } from 'hono/cors'
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import bcrypt from "bcryptjs";
import { decode, sign, verify } from 'hono/jwt'

declare module 'hono' {
  interface ContextVariableMap {
    database: SupabaseClient,
    user: {id: Number, created_at: Date, username: string, email: string, iat: Date, exp: Date}
  }
}

type Bindings= {
  jwt_secret: string,
  db_url: string,
  db_secret: string

}
const app = new Hono<{ Bindings: Bindings }>()


app.use(cors())

app.use(async (context, next) => {
  if (context.req.path != "/auth" && context.req.path != "/auth/register" && context.req.query('prod') == undefined) {
  if (!context.req.header("authorization")) {
    context.status(401)
    return context.json({error: "Missing Authorization"})
  }
}
let supabase = await createClient(context.env.db_url, context.env.db_secret);
context.set("database",supabase) 
  await next()
})



/* 
POINTS

*/

app.get("/leaderboard", async (context)=> {
  let {data,error} = await context.var.database.from("Users").select("*").order('points', 
    { ascending: false }
  )
  if (error) {
    return context.json({error: "Error With Database"})
  }
  return context.json({data})
})

app.post("/points", async (context)=> {
  const body: {points: number, id: number} = await context.req.json()
  if (!body && body.points && body.id) {
    return context.json({error: "Details Not Present"})
  }
  let { data, error } = await context.var.database
  .from('Users')
  .select().eq("id", body.id).maybeSingle()
  if (error) {
    return context.json({error: "Error With Database"})
  }
  if (data) {
    let {error} = await context.var.database.from("Users").update({points: data.points+body.points}).eq("id", body.id)
    if (error) {
      return context.json({error: error.message})
    } else {
      return context.json({success: "Incremented Points"})
    }
  }
})

//POINTs

/* AUTHORIZATION */


//SIGN IN
app.post("auth", async (context)=> {
  const body: {email: string, password: string} = await context.req.json();
  if (!body && body.email && body.password) {
    return context.json({error: "No Emai Or Password Present"})
  }
  let {data,error} = await context.var.database.from("Users").select("*").eq("email", body.email).maybeSingle()
  if (error) {
    return context.json({error: "Error With Database"})
  }
  if(data) {
    let checkPassword = await bcrypt.compare(body.password, data.password)
    if (checkPassword) {
      delete data['password']
      return context.json({data})
    }
    else {
      context.status(401)
      return context.json({error: "Wrong Credentials"})
    }
  } else { 
    context.status(401)
    return context.json({error: "User Not Found"})
  }


})


//SIGN UP
app.post("/auth/register", async (context)=> {
  const body: {name: string, password: string, email: string} = await context.req.json();
  if (!body.name || !body.password || !body.email) {
    return context.json({error: "Data Missing", data: body})
  }
  let hashedPassword = await bcrypt.hash(body.password, 10)
  let {data,error} = await context.var.database.from("Users").insert({...body, password: hashedPassword}).select()
  if (error) {
    return context.json({error: `There's a error in the database: ${error.message} with error code: ${error.code}`})
  }
  return context.json({data})
})
/* 
 id       Int    @id @default(autoincrement())
  name     String @db.VarChar(255)
  email    String @unique @db.VarChar(350)
  password String @db.VarChar(255)
  points     Int @default(0)



*/


/* AUTHORIZATION */


app.get('/', (c) => {
  return c.text('Hello Hono!')
})

export default app
