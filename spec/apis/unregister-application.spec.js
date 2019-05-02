import * as singleSpa from 'single-spa';

describe('registerApplication', function() {
  let app
  beforeEach(() => {
    app = {
      mount(){
        return Promise.resolve()
      },
      unmount() {
        return Promise.resolve()
      },
      bootstrap() {
        return Promise.resolve()
      }
    }
  })

  it(`should throw an error if no such application exists`, () => {
    expect(() => {
      singleSpa.unregisterApplication(`app that doesn't exist`)
    }).toThrow()
  })

  it(`should remove the application so it can be re-registered`, () => {
    singleSpa.registerApplication('about to unregister', app, () => false)
    expect(singleSpa.getAppStatus('about to unregister')).toBeTruthy()
    expect(() => {
      singleSpa.registerApplication('about to unregister', app, () => false)
    }).toThrow()

    return singleSpa.unregisterApplication('about to unregister').then(() => {
      expect(singleSpa.getAppStatus('about to unregister')).toBeFalsy()
    })
  })
})
