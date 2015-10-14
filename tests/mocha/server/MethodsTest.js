MochaWeb.testOnly(function() {
  describe('Methods', function() {
    var comp1Id, comp2Id;
    beforeEach(function() {
      [Competitions, Rounds, RoundProgresses, Registrations].forEach(function(collection) {
        collection.remove({});
      });
      stubs.create('Fake login', global, 'throwIfCannotManageCompetition');

      comp1Id = Competitions.insert({ competitionName: "Comp One", listed: false, startDate: new Date() });
      comp2Id = Competitions.insert({ competitionName: "Comp Two", listed: false, startDate: new Date() });
    });
    afterEach(function() {
      stubs.restoreAll();
    });

    it('deleteCompetition', function() {
      [comp1Id, comp2Id].forEach(function(compId) {
        var roundId = make(Rounds, { competitionId: compId, eventCode: '333', nthRound: 1, totalRounds: 1 })._id;
        RoundProgresses.insert({ competitionId: compId, roundId: roundId });
      });

      chai.expect(Competitions.find().count()).to.equal(2);
      chai.expect(Rounds.find().count()).to.equal(2);
      chai.expect(RoundProgresses.find().count()).to.equal(2);

      Meteor.call('deleteCompetition', comp1Id);

      chai.expect(Competitions.find().count()).to.equal(1);
      chai.expect(Rounds.find().count()).to.equal(1);
      chai.expect(RoundProgresses.find().count()).to.equal(1);
    });

    it('addRound and removeLastRound', function() {
      Meteor.call('addRound', comp1Id, '333');
      Meteor.call('addRound', comp1Id, '444'); // decoy
      Meteor.call('addRound', comp2Id, '333'); // decoy

      var rounds = Rounds.find({competitionId: comp1Id, eventCode: '333'}).fetch();
      chai.expect(rounds.length).to.equal(1);
      chai.expect(RoundProgresses.find({roundId: rounds[0]._id}).count()).to.equal(1);
      chai.expect(rounds[0].totalRounds).to.equal(1);

      Meteor.call('addRound', comp1Id, '333');

      rounds = Rounds.find({competitionId: comp1Id, eventCode: '333'}, {sort: {nthRound: 1}}).fetch();
      chai.expect(rounds.length).to.equal(2);
      chai.expect(rounds[0].nthRound).to.equal(1);
      chai.expect(rounds[0].totalRounds).to.equal(2);
      chai.expect(rounds[0].roundCode()).to.equal('1');
      chai.expect(rounds[1].nthRound).to.equal(2);
      chai.expect(rounds[1].totalRounds).to.equal(2);
      chai.expect(rounds[1].roundCode()).to.equal('f');

      Meteor.call('removeLastRound', comp1Id, '333');

      rounds = Rounds.find({competitionId: comp1Id, eventCode: '333'}).fetch();
      chai.expect(rounds.length).to.equal(1);
      chai.expect(RoundProgresses.find({roundId: rounds[0]._id}).count()).to.equal(1);
      chai.expect(rounds[0].totalRounds).to.equal(1);

      Meteor.call('removeLastRound', comp1Id, '333');

      chai.expect(Rounds.find({competitionId: comp1Id, eventCode: '333'}).count()).to.equal(0);

      chai.expect(function() {
        Meteor.call('removeLastRound', comp1Id, '333');
      }).to.throw(Meteor.Error);
    });

    it('addRound respects wca.MAX_ROUNDS_PER_EVENT', function() {
      for(var i = 0; i < wca.MAX_ROUNDS_PER_EVENT; i++) {
        Meteor.call('addRound', comp1Id, '333');
      }
      chai.expect(function() {
        Meteor.call('addRound', comp1Id, '333');
      }).to.throw(Meteor.Error);
    });

    describe('manage check-in', function() {
      var registration;
      var firstRound333;
      beforeEach(function() {
        Meteor.call('addRound', comp1Id, '333');
        firstRound333 = Rounds.findOne({competitionId: comp1Id, eventCode: '333', nthRound: 1});
        registration = make(Registrations, {competitionId: comp1Id});
      });

      describe('when not checked in', function() {
        it('toggleEventRegistration', function() {
          Meteor.call('toggleEventRegistration', registration._id, '333');
          chai.expect(Results.find({registrationId: registration._id, eventCode: '333', nthRound: 1}).count()).to.equal(0);
          chai.expect(Registrations.findOne(registration._id).registeredEvents).to.deep.equal(['333']);
        });
      });

      describe('when checked in for 333', function() {
        var result;
        beforeEach(function() {
          Meteor.call('checkInRegistration', registration._id, true);
          Meteor.call('toggleEventRegistration', registration._id, '333');
          var results = Results.find({registrationId: registration._id, roundId: firstRound333._id}).fetch();
          chai.expect(results.length).to.equal(1);
          result = results[0];
        });

        it('created a Result', function() {
          chai.expect(Registrations.findOne(registration._id).checkedIn).to.equal(true);
          chai.expect(Registrations.findOne(registration._id).registeredEvents).to.deep.equal(['333']);
        });

        it('unregistering without times works', function() {
          Meteor.call('checkInRegistration', registration._id, false);
          chai.expect(Results.findOne(result._id)).to.not.exist;
          chai.expect(Registrations.findOne(registration._id).checkedIn).to.equal(false);
        });

        it('unregistering with times throws an exception', function() {
          Meteor.call('setSolveTime', result._id, 0, { millis: 3333 });
          chai.expect(function() {
            Meteor.call('checkInRegistration', registration._id, false);
          }).to.throw(Meteor.Error);
          chai.expect(Results.findOne(result._id)).to.exist;
          chai.expect(Registrations.findOne(registration._id).checkedIn).to.equal(true);
        });
      });
    });

    describe('importRegistrations', function() {
      it('works', function() {
        var competitionJson = {
          "formatVersion": "WCA Competition 0.2",
          "competitionId": "PleaseBeQuiet2015",
          "persons": [
            {
              "id": "1",
              "name": "Jeremy Fleischman",
              "countryId": "US",
              "wcaId": "2005FLEI01",
              "dob": "2014-10-11"
            },
            {
              "id": "2",
              "name": "Patricia Li",
              "wcaId": "2009LIPA01",
              "dob": "2015-09-04"
            }
          ],
          "events": [
            {
              "eventId": "333",
              "rounds": [
                {
                  "roundId": "f",
                  "formatId": "a",
                  "results": [
                    { "personId": "1" },
                    { "personId": "2" },
                  ],
                  "groups": []
                }
              ]
            },
            {
              "eventId": "333oh",
              "rounds": [
                {
                  "roundId": "f",
                  "formatId": "a",
                  "results": [
                    { "personId": "1" },
                  ],
                  "groups": []
                }
              ]
            },
            {
              "eventId": "222",
              "rounds": [
                {
                  "roundId": "f",
                  "formatId": "a",
                  "results": [],
                  "groups": []
                }
              ]
            },
          ]
        };

        Meteor.call('importRegistrations', comp1Id, competitionJson);
        let registrations = _.sortBy(Registrations.find({ competitionId: comp1Id }).fetch(), registration => registration.uniqueName);

        chai.expect(registrations.length).to.equal(2);

        chai.expect(registrations[0].uniqueName).to.equal("Jeremy Fleischman");
        chai.expect(registrations[0].countryId).to.equal("US");
        chai.expect(registrations[0].registeredEvents).to.deep.equal(["333", "333oh"]);

        chai.expect(registrations[1].uniqueName).to.equal("Patricia Li");
        chai.expect(registrations[1].registeredEvents).to.deep.equal(["333"]);

        // Remove Jeremy from 333 round 1.
        competitionJson.events[0].rounds[0].results.shift();
        // Change Jeremy's country to Israel
        competitionJson.persons[0].countryId = "IL";
        // Add Patricia to round 333oh round 1.
        competitionJson.events[1].rounds[0].results.push({ personId: 2 });
        // Import the JSON again, Patricia should now be signed up for 333oh, and
        // Jeremy should be removed from 333 round 1, since neither of them was
        // checked in.
        Meteor.call('importRegistrations', comp1Id, competitionJson);
        registrations = _.sortBy(Registrations.find({ competitionId: comp1Id }).fetch(), registration => registration.uniqueName);

        chai.expect(registrations.length).to.equal(2);

        chai.expect(registrations[0].uniqueName).to.equal("Jeremy Fleischman");
        chai.expect(registrations[0].countryId).to.equal("IL");
        chai.expect(registrations[0].registeredEvents).to.deep.equal(["333oh"]);

        chai.expect(registrations[1].uniqueName).to.equal("Patricia Li");
        chai.expect(registrations[1].registeredEvents).to.deep.equal(["333", "333oh"]);

        // Check Patricia in.
        Meteor.call('checkInRegistration', registrations[1]._id, true);
        // Remove Patricia from 333oh round 1.
        competitionJson.events[1].rounds[0].results.pop();
        // And add her to 222 round 1.
        competitionJson.events[2].rounds[0].results.push({ personId: "2" });
        // Reimporting should not change her events, because she's already
        // checked in.
        Meteor.call('importRegistrations', comp1Id, competitionJson);
        registrations = _.sortBy(Registrations.find({ competitionId: comp1Id }).fetch(), registration => registration.uniqueName);

        chai.expect(registrations.length).to.equal(2);

        chai.expect(registrations[0].uniqueName).to.equal("Jeremy Fleischman");
        chai.expect(registrations[0].registeredEvents).to.deep.equal(["333oh"]);

        chai.expect(registrations[1].uniqueName).to.equal("Patricia Li");
        chai.expect(registrations[1].registeredEvents).to.deep.equal(["333", "333oh"]);
      });

      it('adds missing events', function() {
        var competitionJson = {
          "formatVersion": "WCA Competition 0.2",
          "competitionId": "PleaseBeQuiet2015",
          "persons": [
          ],
          "events": [
            {
              "eventId": "333",
              "rounds": [
                {
                  "roundId": "f",
                  "formatId": "a",
                  "results": [],
                  "groups": []
                },
              ]
            },
            {
              "eventId": "333oh",
              "rounds": [
                {
                  "roundId": "1",
                  "formatId": "a",
                  "results": [],
                  "groups": []
                },
                {
                  "roundId": "f",
                  "formatId": "a",
                  "results": [],
                  "groups": []
                },
              ]
            },
            {
              "eventId": "222",
              "rounds": [
                {
                  "roundId": "f",
                  "formatId": "a",
                  "results": [],
                  "groups": []
                },
              ]
            },
          ]
        };

        Meteor.call('importRegistrations', comp1Id, competitionJson);
        chai.expect(Rounds.find({ competitionId: comp1Id, eventCode: "333" }).count()).to.equal(1);
        chai.expect(Rounds.find({ competitionId: comp1Id, eventCode: "333oh" }).count()).to.equal(2);
        chai.expect(Rounds.find({ competitionId: comp1Id, eventCode: "222" }).count()).to.equal(1);
      });
    });

    describe('advanceParticipantsFromRound', function() {
      it('works', function() {
        Meteor.call('addRound', comp1Id, '333');
        Meteor.call('addRound', comp1Id, '333');

        var rounds = Rounds.find({
          competitionId: comp1Id,
          eventCode: '333',
        }, {
          sort: {
            nthRound: 1,
          }
        }).fetch();

        var registration1 = make(Registrations, {competitionId: comp1Id});
        var result1 = make(Results, {competitionId: comp1Id, roundId: rounds[0]._id, position: 1, registrationId: registration1._id});
        var registration2 = make(Registrations, {competitionId: comp1Id});
        var result2 = make(Results, {competitionId: comp1Id, roundId: rounds[0]._id, position: 2, registrationId: registration2._id});
        Meteor.call('advanceParticipantsFromRound', 1, rounds[0]._id);

        var results = Results.find({ roundId: rounds[1]._id }).fetch();
        chai.expect(results.length).to.equal(1);
        chai.expect(results[0].registrationId).to.equal(registration1._id);
      });
    });

    describe("toggleGroupOpen", function() {
      var roundId;
      var groupId;
      beforeEach(function() {
        var round = make(Rounds, { status: wca.roundStatuses.open });
        roundId = round._id;
        groupId = make(Groups, { group: "A", roundId: round._id })._id;
      });

      it("works", function() {
        chai.expect(Groups.findOne(groupId).open).to.equal(false);
        Meteor.call('toggleGroupOpen', groupId);
        chai.expect(Groups.findOne(groupId).open).to.equal(true);
      });

      it("doesn't allow opening groups for closed rounds", function() {
        chai.expect(Groups.findOne(groupId).open).to.equal(false);

        Rounds.update(roundId, { $set: { status: wca.roundStatuses.closed } });
        chai.expect(function() {
          Meteor.call('toggleGroupOpen', groupId);
        }).to.throw(Meteor.Error);

        chai.expect(Groups.findOne(groupId).open).to.equal(false);
      });
    });

    describe("setSolveTime", function() {
      var firstRound333;
      var registration;
      var result;
      beforeEach(function() {
        Meteor.call('addRound', comp1Id, '333');
        firstRound333 = Rounds.findOne({competitionId: comp1Id, eventCode: '333', nthRound: 1});
        registration = make(Registrations, {competitionId: comp1Id});

        Meteor.call('checkInRegistration', registration._id, true);
        Meteor.call('toggleEventRegistration', registration._id, '333');
        var results = Results.find({registrationId: registration._id, roundId: firstRound333._id}).fetch();
        chai.expect(results.length).to.equal(1);
        result = results[0];
      });

      it("can add times", function() {
        for(var i = 0; i < firstRound333.format().count; i++) {
          Meteor.call('setSolveTime', result._id, i, { millis: 3333 + i });
        }
        result = Results.findOne(result._id);
        chai.expect(result.solves.length).to.equal(5);
        chai.expect(result.solves[0].millis).to.equal(3333);
        chai.expect(result.solves[1].millis).to.equal(3334);
        chai.expect(result.solves[2].millis).to.equal(3335);
        chai.expect(result.solves[3].millis).to.equal(3336);
        chai.expect(result.solves[4].millis).to.equal(3337);
      });

      it("can't add more times than round allows", function() {
        var i;
        for(i = 0; i < firstRound333.format().count; i++) {
          Meteor.call('setSolveTime', result._id, i, { millis: 3333 + i });
        }
        chai.expect(function() {
          Meteor.call('setSolveTime', result._id, i, { millis: 3333 + i });
        }).to.throw(Meteor.Error);
      });

      it("can remove extra times", function() {
        // Add all 5 allowed solves for this round format.
        for(i = 0; i < firstRound333.format().count; i++) {
          Meteor.call('setSolveTime', result._id, i, { millis: 3333 + i });
        }
        // Change this round to a mean of 3, which means we have too many
        // solves in our result. We should be allowed to change and delete
        // these extra solves because they were grandfathered in.
        Rounds.update(firstRound333._id, { $set: { formatCode: "3" } });
        Meteor.call('setSolveTime', result._id, 3, null);
        chai.expect(Results.findOne(result._id).solves.length).to.equal(5);
        Meteor.call('setSolveTime', result._id, 3, { millis: 4242 });
        chai.expect(Results.findOne(result._id).solves.length).to.equal(5);
        Meteor.call('setSolveTime', result._id, 4, null);
        chai.expect(Results.findOne(result._id).solves.length).to.equal(4);
        Meteor.call('setSolveTime', result._id, 3, null);
        chai.expect(Results.findOne(result._id).solves.length).to.equal(3);

        // Now that we're down to the maximum of 3 solves, we should not be
        // allowed to add a 4th.
        chai.expect(function() {
          Meteor.call('setSolveTime', result._id, 3, { millis: 2323 });
        }).to.throw(Meteor.Error);
      });
    });

  });
});
