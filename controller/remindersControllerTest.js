const chai = require('chai');
const expect = chai.expect;
const sinon = require('sinon');
const remindersController = require('./remindersController');
const pool = require('./pool');

describe('Reminders Controller', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('should list reminders', async () => {
    const req = { user: { UserID: 1 } };
    const res = { render: sinon.spy() };
    const mockData = [[{ ReminderID: 1, Title: 'Test' }], {}];
    sinon.stub(pool, 'query').returns(Promise.resolve(mockData));

    await remindersController.list(req, res);
    expect(res.render.calledOnce).to.be.true;
    expect(res.render.firstCall.args[0]).to.equal('reminder/index');
    expect(res.render.firstCall.args[1]).to.deep.equal({ reminders: mockData[0], user: req.user });
  });

 
});
