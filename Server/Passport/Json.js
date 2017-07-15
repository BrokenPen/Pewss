import { Strategy as LocalStrategy } from 'passport-local'
import Encrypt from '../Encrypt.js'
const JSON_Strategy = (passport, users) => {
  passport.serializeUser((user, done) => {
    done(null, user.name)
  })

  passport.deserializeUser((name, done) => {
    const user = users[name]
    done(null, (user === undefined) ? false : user)
  })

  passport.use('json', new LocalStrategy({
    usernameField: 'name',
    passwordField: 'passwd',
    session: true
  }, (name, passwd, done) => {
    let user = users[name]
    if (user === undefined) {
      done(null, false)
      return
    }

    Encrypt.compare(passwd, user.passwd).then(res => {
      if (res === false) {
        done(null, false)
      } else {
        done(null, user)
      }
    })
  }))
}

module.exports = JSON_Strategy
