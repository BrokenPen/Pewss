import Express from 'express'
import BodyParser from 'body-parser'
import Compression from 'compression'
import Passport from 'passport'
import Session from 'express-session'
import Https from 'https'
import Secrets from './Secrets.js'
import SimController from './SimController.js'
import UserManager from './UserManager.js'
import { BaseDir, log } from './Utils.js'
import LocalPass from './Passport/LocalPass.js'
import helmet from 'helmet'
import {fTypes} from './File.js'
// initialize modules and variables

const APP = Express()
const PORT = 8081
UserManager.init().then(async () => {
  await UserManager.loadUsers()
  const Users = UserManager.getUsers()
  for (const user in Users) {
    await Users[user].scanHome()
    Users[user].restore()
  }
  LocalPass(Passport, Users)
})

Https.createServer(Secrets.TLS, APP).listen(PORT, () => {
  log(`Https server listening on port ${PORT}.`, 'info')
})

APP.use(helmet())
APP.use(Session(Secrets.Session))
APP.use(BodyParser.json())
APP.use(BodyParser.urlencoded({ extended: true }))
APP.use(Compression())
APP.use(Passport.initialize())
APP.use(Passport.session())

APP.use('/build', Express.static(`${BaseDir}/Client/build`))
APP.use('/vs', Express.static(`${BaseDir}/node_modules/monaco-editor/min/vs`))
APP.use('/node_modules', Express.static(`${BaseDir}/node_modules`))
APP.use('/', Express.static(`${BaseDir}/Client/build`))
APP.use('/doc-kernel', Express.static(`${BaseDir}/Server/Sim/env/kernel.doc`))
APP.use('/doc-workflow', Express.static(`${BaseDir}/Server/Sim/env/workflow.doc`))

// ======================
// html request
//

const isLogin = (req, res, next) => {
  if (req.isAuthenticated()) {
    return next()
  } else {
    res.redirect('/login')
  }
}

const getJPath = (env, meta) => {
  return (meta.Owner === 'admin')
    ? SimController.getBuiltin(env).find(f => f.Owner === meta.Owner && f.Cate === meta.Cate && f.Name === meta.Name).JPath
    : UserManager.getUser(meta.Owner).getFile(meta.Type, meta.Cate, meta.Name).getJPath()
}

const getUser = (req) => {
  return UserManager.getUser(req.user.Name)
}

APP.get('/index', isLogin, (req, res) => {
  log(`${req.method} ${req.originalUrl}`, 'info', {c: 200, req})
  res.status(200).sendFile(`${BaseDir}/Client/Index.html`)
})

APP.get('/', isLogin, (req, res) => {
  log(`${req.method} ${req.originalUrl}`, 'info', {c: 200, req})
  res.redirect('/index')
})

APP.get('/login', (req, res) => {
  log(`${req.method} ${req.originalUrl}`, 'info', {c: 200, req})
  res.status(200).sendFile(`${BaseDir}/Client/Login.html`)
})

APP.get('/api/uses/username', (req, res) => {
  log(`${req.method} ${req.originalUrl}`, 'info', {c: 200, req})
  res.status(200).send(req.user.Name)
})

// ======================
// authentication api
//

APP.post('/login', Passport.authenticate('json'), (req, res) => {
  log(`${req.method} ${req.originalUrl}`, 'info', {c: 200, req})
  res.status(200).send('/index')
})

APP.get('/logout', isLogin, (req, res) => {
  log(`${req.method} ${req.originalUrl}`, 'info', {c: 200, req})
  req.logout()
  res.status(200).send('/login')
})

// ======================
// api for uses
//
// always check user first

/* no request data */
APP.get('/api/uses/envs', isLogin, (req, res) => {
  const User = getUser(req)
  const lmsg = `${req.method} ${req.originalUrl}`

  if (User) {
    log(lmsg, 'info', {c: 200, req})
    res.status(200).json(SimController.getEnvs())
  } else {
    log(lmsg, 'warning', {c: 200, req})
    res.sendStatus(401)
  }
})

/* no request data */
APP.get('/api/uses/class', isLogin, (req, res) => {
  const User = getUser(req)
  const lmsg = `${req.method} ${req.originalUrl}`
  if (!User) {
    log(lmsg, 'warning', {c: 401, req})
    res.sendStatus(401)
    return
  }

  let resFiles = UserManager.getClassFiles(User.getName())
  resFiles = resFiles.concat(SimController.getBuiltin(req.query.env))

  log(lmsg, 'info', {c: 200, req})
  res.status(200).json(resFiles)
})

/* no request data */
APP.get('/api/uses/source', isLogin, (req, res) => {
  const User = getUser(req)
  const lmsg = `${req.method} ${req.originalUrl}`
  if (User) {
    log(lmsg, 'info', {c: 200, req})
    res.status(200).json(UserManager.getJavaFiles(User.getName()))
  } else {
    log(lmsg, 'warning', {c: 401, req})
    res.sendStatus(401)
  }
})

/* request data: { env, generator, scheduler, simulator, platform, argums } */
APP.post('/api/uses/simulate', isLogin, async (req, res) => {
  const User = getUser(req)
  const lmsg = `${req.method} ${req.originalUrl} ${JSON.stringify(req.body)}`
  if (!User) {
    log(lmsg, 'warning', {c: 401, req})
    res.sendStatus(401)
    return
  }

  try {
    const simres = await SimController.simulate(
      req.body.env,
      getJPath(req.body.env, req.body.generator),
      getJPath(req.body.env, req.body.scheduler),
      getJPath(req.body.env, req.body.simulator),
      getJPath(req.body.env, req.body.platform),
      req.body.argums
    )
    res.status(200).json(simres)
    log(lmsg, 'info', {c: 200, req})
  } catch (err) {
    res.status(500).send()
    log(lmsg, 'error', {c: 500, req, err})
  }
})

// compile source file
/* request data: {filename, category, owner} */
APP.post('/api/uses/compile', isLogin, async (req, res) => {
  const User = getUser(req)
  const lmsg = `${req.method} ${req.originalUrl} ${JSON.stringify(req.body)}`
  if (!User) {
    log(lmsg, 'warning', {c: 401, req})
    res.sendStatus(401)
    return
  }
  await SimController.compile(
    req.body.env,
    req.body.fOwner,
    req.body.fCate,
    req.body.fName
  ).then(async (_res) => {
    log(lmsg, 'info', {c: 200, req})
    res.status(200).json(_res)
    await User.scanHome()
  }).catch(err => {
    log(lmsg, 'error', {c: 500, req})
    res.status(500).json(err)
  })
})

/* request data: { filename, category, owner } */
APP.get('/api/uses/source_content', isLogin, async (req, res) => {
  const User = getUser(req)
  const lmsg = `${req.method} ${req.originalUrl}`
  if (!User) {
    log(lmsg, 'warning', {c: 401, req})
    res.sendStatus(401)
    return
  }

  const content = await User.getFileContent(req.query.fCate, req.query.fName)
  const isPub = UserManager.isPub(
    req.query.fOwner,
    fTypes.Class,
    req.query.fCate,
    req.query.fName
  )
  if (content) {
    log(lmsg, 'info', {c: 200, req})
    res.status(200).json({ data: content, isPub })
  } else {
    log(lmsg, 'error', {c: 404, req})
    res.sendStatus(404)
  }
})

APP.param('file_name', (req, res, next, id) => {
  next()
})

// update source file
/* request data: {filename, category, content, owner} */
APP.patch('/api/uses/source_content/:file_name', isLogin, async (req, res) => {
  const User = getUser(req)
  const lmsg = `${req.method} ${req.originalUrl}`
  if (!User) {
    log(lmsg, 'warning', {c: 401, req})
    res.sendStatus(401)
    return
  }

  try {
    await User.setFileContent(
      req.body.fCate,
      req.body.fName,
      req.body.fContent
    )
    log(lmsg, 'info', {c: 200, req})
    res.status(200).send('Save complete')
  } catch (err) {
    log(lmsg, 'error', {c: 200, req})
    res.status(500).send(err.msg)
  }
})

// create new source file
/* request data: {filename, category, content, owner} */
APP.post('/api/uses/source_content/:file_name', isLogin, async (req, res) => {
  const User = getUser(req)
  const lmsg = `${req.method} ${req.originalUrl}`
  if (!User) {
    log(lmsg, 'warning', {c: 401, req})
    res.sendStatus(401)
    return
  }

  try {
    await User.newFile(
      req.body.fCate,
      req.body.fName,
      req.body.fContent
    )
    await User.scanHome()
    log(lmsg, 'info', {c: 200, req})
    res.status(200).send('Save complete')
  } catch (err) {
    log(lmsg, 'error', {c: 500, req})
    res.status(500).send(err.msg)
  }
})

// ======================
// api for database
//

APP.param('target', (req, res, next, id) => {
  next()
})

APP.patch('/api/users/public/:target', async (req, res) => {
  const User = getUser(req)
  const lmsg = `${req.method} ${req.originalUrl}`

  if (!User) {
    log(lmsg, 'warning', {c: 401, req})
    res.sendStatus(401)
  }

  try {
    await UserManager.modUser(User.getName(), {
      $addPub: {
        type: req.body.fType,
        cate: req.body.fCate,
        name: req.body.fName
      }
    })
    log(lmsg, 'info', {c: 200, req})
    res.sendStatus(200)
  } catch (err) {
    log(lmsg, 'error', {c: 500, req})
    res.status(500).send(err.msg)
  }
})

APP.delete('/api/users/public/:target', async (req, res) => {
  const User = getUser(req)
  const lmsg = `${req.method} ${req.originalUrl}`
  if (User) {
    await UserManager.modUser(User.getName(), {
      $removePub: {
        type: req.body.fType,
        cate: req.body.fCate,
        name: req.body.fName
      }
    })
    log(lmsg, 'info', {c: 200, req})
    res.sendStatus(200)
  } else {
    log(lmsg, 'warning', {c: 401, req})
    res.sendStatus(401)
  }
})

APP.patch('/api/users/password/:target', async (req, res) => {
  const User = getUser(req)
  const lmsg = `${req.method} ${req.originalUrl}`
  if (User) {
    await UserManager.modUser(User.getName(), {
      $updatePassword: req.body.passwd
    })
    log(lmsg, 'info', {c: 200, req})
    res.sendStatus(200)
  } else {
    log(lmsg, 'warning', {c: 401, req})
    res.sendStatus(401)
  }
})
