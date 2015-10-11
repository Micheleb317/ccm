var log = logging.handle("manageCheckin");

var selectedRegistrationReact = new ReactiveVar(null);
var wcaCompetitionDataReact = new ReactiveVar(null);
Template.manageCheckin.created = function() {
  var template = this;
  selectedRegistrationReact.set(null);
};

Template.manageCheckin.rendered = function() {
  var template = this;

  template.autorun(function() {
    var data = Template.currentData();

    React.render(
      <CheckinList competitionId={data.competitionId} />,
      template.$(".reactRenderArea")[0]
    );
  });

  template.autorun(function() {
    var data = Template.currentData();
    var competition = Competitions.findOne(data.competitionId, { fields: { wcaCompetitionId: 1 } });
    var pendingWcaAjax = $.get("https://www.worldcubeassociation.org/api/v0/competitions/" + encodeURIComponent(competition.wcaCompetitionId));
    pendingWcaAjax.done(data => {
      wcaCompetitionDataReact.set(data);
    });
    pendingWcaAjax.fail(data => {
      wcaCompetitionDataReact.set(_.extend({ error: true }, data.responseJSON));
    });
  });
};

Template.manageCheckin.destroyed = function() {
  var template = this;
  selectedRegistrationReact.set(null);
  var unmounted = React.unmountComponentAtNode(
    template.$(".reactRenderArea")[0]
  );
  assert(unmounted);
};

Template.manageCheckin.helpers({
  selectedRegistration: function() {
    return selectedRegistrationReact.get();
  },
});

Template.manageCheckin.events({
  'click .addParticipant': function() {
    var newRegistration = {
      competitionId: this.competitionId,
    };
    selectedRegistrationReact.set(newRegistration);
    $("#modalEditRegistration").modal('show');
  },
  'click .js-delete-registration': function() {
    var that = this;
    var confirmStr = "Are you sure you want to delete the registration for " + this.uniqueName + "?";
    bootbox.confirm(confirmStr, function(confirm) {
      if(confirm) {
        Registrations.remove(that._id);
        $("#modalEditRegistration").modal('hide');
      }
    });
  },
  'hidden.bs.modal .modal': function(e, template) {
    selectedRegistrationReact.set(null);
    AutoForm.resetForm('editRegistrationForm');
  },
});

Template.modalEditRegistration.helpers({
  editRegistrationFormType: function() {
    return this._id ? "update" : "insert";
  },
});

AutoForm.addHooks('editRegistrationForm', {
  onSuccess: function(operation, result, template) {
    $("#modalEditRegistration").modal('hide');
  },
});

Template.modalImportRegistrations.helpers({
  registrationJson: function() {
    return registrationJsonReact.get();
  },
  registrationJsonParseError: function() {
    return registrationJsonParseErrorReact.get();
  },
  cusaJsonUrl: function() {
    var wcaCompetitionData = wcaCompetitionDataReact.get();
    if(wcaCompetitionData && !wcaCompetitionData.error) {
      if(wcaCompetitionData.website.indexOf("cubingusa.com") >= 0) {
        if(wcaCompetitionData.website[wcaCompetitionData.website.length - 1] !== "/") {
          wcaCompetitionData.website += "/";
        }
        return wcaCompetitionData.website + "admin/json.php";
      }
    }
    return null;
  },
});

var registrationJsonReact = new ReactiveVar(null);
var registrationJsonParseErrorReact = new ReactiveVar(null);
Template.modalImportRegistrations.events({
  'input textarea[name="registrationJson"]': function(e) {
    try {
      registrationJsonReact.set(JSON.parse(e.currentTarget.value));
      registrationJsonParseErrorReact.set(null);
    } catch(error) {
      registrationJsonReact.set(null);
      registrationJsonParseErrorReact.set(e.currentTarget.value.length > 0 ? error : "");
    }
  },
  'click button[type="submit"]': function(e) {
    var registrationJson = registrationJsonReact.get();
    assert(registrationJson);
    var data = Template.parentData(1);
    Meteor.call('importRegistrations', data.competitionId, registrationJson, function(error) {
      if(error) {
        bootbox.alert(`Error importing registrations: ${error.reason}`);
      } else {
        $('#modalImportRegistrations').modal('hide');
      }
    });
  },
});

var CheckinList = React.createClass({
  mixins: [ReactMeteorData],

  getMeteorData: function() {
    var competitionId = this.props.competitionId;
    var registrations = Registrations.find({ competitionId: competitionId }, { sort: { uniqueName: 1 } }).fetch();

    var competitionEvents = getCompetitionEvents(this.props.competitionId);

    return {
      registrations: registrations,
      competitionEvents,
    };
  },
  componentWillMount: function() {
    log.l1("component will mount");
  },
  componentDidMount: function() {
    log.l1("component did mount");

    var $checkinTable = $(this.refs.checkinTable.getDOMNode());
    makeTableSticky($checkinTable);
  },
  componentWillUpdate(nextProps, nextState) {
    log.l1("component will update");
    var $checkinTable = $(this.refs.checkinTable.getDOMNode());
    $checkinTable.find('thead tr th').css({ minWidth: "", maxWidth: "" });
    makeTableNotSticky($checkinTable);
  },
  componentDidUpdate(prevProps, prevState) {
    log.l1("component did update");
    var $checkinTable = $(this.refs.checkinTable.getDOMNode());
    makeTableSticky($checkinTable);
  },
  componentWillUnmount: function() {
    log.l1("component will unmount");

    var $checkinTable = $(this.refs.checkinTable.getDOMNode());
    makeTableNotSticky($checkinTable);
  },
  registeredCheckboxToggled: function(registration, event) {
    Meteor.call('toggleEventRegistration', registration._id, event.eventCode, function(error) {
      if(error) {
        bootbox.alert(`Error changing registration: ${error.reason}`);
      }
    });
  },
  checkInClicked: function(registration, e) {
    Meteor.call('checkInRegistration', registration._id, !registration.checkedIn, function(error) {
      if(error) {
        bootbox.alert(`Error checking in: ${error.reason}`);
      }
    });
  },
  handleEditRegistration: function(registration) {
    selectedRegistrationReact.set(registration);
    $("#modalEditRegistration").modal('show');
  },
  render: function() {
    var that = this;

    return (
      <div>
        <template name="devinTest">
          <div className="container"></div>
        </template>

        <table id="checkinTable" className="table table-striped table-hover" ref="checkinTable">
          <thead>
            <tr>
              <th>Name</th>
              <th className="text-nowrap">WCA id</th>
              <th>Gender</th>
              <th>Birthday</th>
              {that.data.competitionEvents.map(function(event) {
                return (
                  <th key={event.eventCode} className="text-center">
                    <span className={"cubing-icon icon-" + event.eventCode} alt={event.eventCode}></span><br />
                    <span>{event.eventCode}</span>
                  </th>
                );
              })}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {that.data.registrations.map(function(registration) {
              var eventTds = [];
              that.data.competitionEvents.forEach(function(event) {
                var registeredForEvent = _.contains(registration.registeredEvents, event.eventCode);

                var classes = classNames({
                  'text-center': true,
                });
                var onChange = that.registeredCheckboxToggled.bind(null, registration, event);
                var onClick = function(e) {
                  var $input = $(e.currentTarget).find('input');
                  if($input[0] == e.target) {
                    // Ignore direct clicks on the checkbox, those are handled by the
                    // onChange event listener.
                    return;
                  }
                  onChange();
                };
                eventTds.push(
                  <td key={event.eventCode} className={classes} onClick={onClick}>
                    <input type="checkbox" checked={registeredForEvent} onChange={onChange} />
                  </td>
                );
              });

              var checkinButtonText = registration.checkedIn ? "Un-check-in" : "Check-in";
              var onClick = that.checkInClicked.bind(null, registration);
              var style = {};
              var checkinButton = (
                <button type="button"
                        className="btn btn-default btn-xs"
                        style={style}
                        onClick={onClick}>
                  {checkinButtonText}
                </button>
              );

              var handleEditRegistration = that.handleEditRegistration.bind(null, registration);
              var gender = registration.gender ? wca.genderByValue[registration.gender].label : '';
              return (
                <tr key={registration._id}>
                  <td className="uniqueName">{registration.uniqueName}</td>
                  <td className="wcaId">{registration.wcaId}</td>
                  <td className="gender">{gender}</td>
                  <td className="dob text-nowrap">
                    {formatMomentDateIso8601(moment(registration.dob))}
                  </td>
                  {eventTds}
                  <td className="text-nowrap">
                    <button type="button"
                            name="buttonEditRegistration"
                            className="btn btn-default btn-xs"
                            onClick={handleEditRegistration}>
                      <span className="glyphicon glyphicon-wrench"></span>
                    </button>
                    {checkinButton}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }
});
