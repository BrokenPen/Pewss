import Express from 'express'
import BodyParser from 'body-parser'
import Compression from 'compression'
import Passport from 'passport'
import Session from 'express-session'
import http from 'http'
import helmet from 'helmet'

import Secrets from './Secrets'
import Config from './Config.json'
import { LocalStrategy } from './Passport'
import { SimController } from './Sim'
import { UserManager } from './User'
import { isLogin, writeLog } from './MiddleWare.js'
import { fTypes } from './File'
import {
  JFileRead,
  JFileDelete,
  JFileStore,
  JUserMod,
  JCompile,
  JSimulation,
  JobManager
} from './Jobs'

require('./Utils.js')()

const APP = Express()
const RTR = Express.Router()
const PORT = Config.Server.Port

http.createServer(APP).listen(PORT, () => {
  global.log(`Start Pewss on ${global.node_env} mode. Listening on port ${PORT}.`, 'info')
})

JobManager.register(
  JFileRead,
  JFileDelete,
  JFileStore,
  JUserMod,
  JCompile,
  JSimulation
)

APP.use(helmet())
APP.use(Session(Secrets.Session))
APP.use(BodyParser.json())
APP.use(BodyParser.urlencoded({ extended: true }))
APP.use(Compression())
APP.use(Passport.initialize())
APP.use(Passport.session())

APP.use('/Client',
  Express.static(`${global.path.client}`))
APP.use('/vs',
  Express.static(`${global.path.node_modules}/monaco-editor/min/vs`))
APP.use('/node_modules',
  Express.static(`${global.path.node_modules}`))
APP.use('/doc-kernel',
  Express.static(`${global.path.sim}/env/kernel.doc`))
APP.use('/doc-workflow',
  Express.static(`${global.path.sim}/Server/Sim/env/workflow.doc`))

UserManager.init().then(async () => {
  await UserManager.loadUsers()
  UserManager.restoreUsers()
  UserManager.getUsers().forEach(async u => {
    await u.scanHome()
  })
  LocalStrategy(Passport)
})

APP.all('/*', writeLog)

APP.get('/index', isLogin, (req, res) => {
  res.status(200).sendFile(`${global.path.client}/Index.html`)
})

APP.get('/', isLogin, (req, res) => {
  res.redirect('/index')
})

APP.get('/login', (req, res) => {
  res.status(200).sendFile(`${global.path.client}/Login.html`)
})

APP.post('/login', Passport.authenticate('local'), (req, res) => {
  res.status(200).send('/index')
})

APP.get('/logout', isLogin, (req, res) => {
  req.logout()
  res.status(200).send('/login')
})

RTR.param(['uname', 'type', 'fname', 'info'], (req, res, next, id) => {
  next()
})

RTR.all('*', isLogin)

RTR.route('/users/:uname/profile')
  /* update user profile */
  .patch(async (req, res) => {
    const uid = req.user.getId()
    JobManager.add(new JUserMod(uid,
      req.body
    ), (result) => {
      res.status(200).json(result)
    }, (result) => {
      res.status(500).send(result)
    })
  })

const getAllClassFiles = (type, env, uid) => {
  if (type === fTypes.Class) {
    return UserManager.getClassFiles(uid)
      .concat(SimController.getBuiltin(env))
  } else if (type === fTypes.Java) {
    return UserManager.getJavaFiles(uid)
  }
}

RTR.route('/users/:uname/files/:type')
  /* get file list */
  .get(async (req, res, next) => {
    await req.user.scanHome()
    const uid = req.user.getId()
    res.status(200).json(getAllClassFiles(req.params.type, req.query.env, uid))
  })
  /* create new file */
  .post(async (req, res) => {
    const User = req.user
    JobManager.add(new JFileStore(User.getId(), req.body), async (result) => {
      await User.scanHome()
      res.status(200).json(result)
    }, (result) => {
      res.status(500).send(result)
    })
  })
  /* delete file */
  .delete(async (req, res) => {
    const User = req.user
    JobManager.add(new JFileDelete(User.getId(), req.body), async (result) => {
      await User.scanHome()
      res.status(200).json(result)
    }, (result) => {
      res.status(500).send(result)
    })
  })

RTR.route('/users/:uname/files/source/:fname')
  /* get file content */
  .get(async (req, res) => {
    const uid = req.user.getId()
    JobManager.add(new JFileRead(uid, req.query), async (result) => {
      res.status(200).json(result)
    }, (result) => {
      res.status(404).send(result)
    })
  })
  /* compile */
  .post(async (req, res) => {
    const User = req.user
    JobManager.add(new JCompile(req.body), async (result) => {
      res.status(200).json(result)
      await User.scanHome()
    }, (result) => {
      res.status(500).send(result)
    })
  })
  /* update file content */
  .patch(async (req, res) => {
    const uid = req.user.getId()
    JobManager.add(new JFileStore(uid, req.body), (result) => {
      res.status(200).json(result)
    }, (result) => {
      res.status(500).send(result)
    })
  })

RTR.route('/users/:uname/files/public/:fname')
  /* add public file */
  .patch(async (req, res) => {
    const uid = req.user.getId()
    JobManager.add(new JUserMod(uid, {
      $addPub: req.body
    }), (result) => {
      res.status(200).json(result)
    }, (result) => {
      res.status(500).send(result)
    })
  })
  /* remove public file */
  .delete(async (req, res) => {
    const uid = req.user.getId()
    JobManager.add(new JUserMod(uid, {
      $removePub: req.body
    }), (result) => {
      res.status(200).json(result)
    }, (result) => {
      res.status(500).send(result)
    })
  })

RTR.route('/sim')
  /* get supported env */
  .get((req, res, next) => {
    res.status(200).json(SimController.getEnvs())
  })
  /* simulate */
  .post(async (req, res) => {
    JobManager.add(new JSimulation(req.user.getName(), req.body), (result) => {
      res.status(200).json(result)
    }, (result) => {
      res.status(500).send(result)
    })
  })
  /* delete simulation job */
  .delete(async (req, res) => {
    JobManager.add(new JSimulation(req.body), (result) => {
      res.status(200).json(result)
    }, (result) => {
      res.status(500).send(result)
    })
  })

APP.use('/api', RTR)
