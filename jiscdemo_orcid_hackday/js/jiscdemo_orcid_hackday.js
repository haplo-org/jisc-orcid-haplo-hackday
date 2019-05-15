
var getAttributes = function(o, d) {
    return _.map(o.every(d), (v) => O.isRef(v) ? v.load().title : v.toString());
};

var getSingleAttributeMaybe = function(o, d) {
    return o.first(d) ? o.first(d).toString() : "";
};

P.respond("GET", "/api/demojisc-hackday/get-people-data", [
    {pathElement:0, as:"string", optional:true}
], function(E, format) {
    let people = [];
    // TODO: Set up a service user with appropriate permissions
    O.withoutPermissionEnforcement(() => {
        O.query().link(T.Person, A.Type).execute().each((object) => {
            if(!format) {
                people.push(getPersonData(object));
            }
            if(format === "schema-org") {
                people.push(getPersonAsSchemaDotOrg(object));
            }
        });
    });
    E.response.body = JSON.stringify(people, undefined, 2);
    E.response.kind = 'text';
});

// --------------------------------------------------------------------------
// Initial Hackday format

var getPersonData = function(object) {
    let data = {
        names: getAttributes(object, A.Title),
        typeOfPerson: getAttributes(object, A.Type),
        emails: getAttributes(object, A.Email),
        institutions: getAttributes(object, A.ResearchInstitute),
        studentId: getAttributes(object, A.StudentId),
        repositoryId: object.ref.toString(),
        orcid: getAttributes(object, A.ORCID),
        orcidIsAuthenticated: !!(O.user(object.ref) && O.service("hres:orcid:integration:for_user", O.user(object.ref)))
    };
    data.publishedWorks = [];
    O.query().
        link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
        link(object.ref).
        execute().each((item) => {
            data.publishedWorks.push({
                title: getAttributes(item, A.Title),
                doi: getAttributes(item, A.DOI),
                issn: getAttributes(item, A.ISSN),
                pubmedID: getAttributes(item, A.PubmedID)
            });
        });
    return data;
};

// --------------------------------------------------------------------------
// schema.org format

var getPersonAsSchemaDotOrg = function(person) {
    let repositoryItems = [];
    O.query().
        link(SCHEMA.getTypesWithAnnotation('hres:annotation:repository-item'), A.Type).
        link(person.ref).
        execute().each((item) => {
            repositoryItems.push(getOutputAsSchemaDotOrg(item));
    });
    return {
        "@context": "http://schema.org",
        "@type": "Person",
        name: person.title,
        email: getAttributes(person, A.Email),
        identifier: [
            { "@type": "PropertyValue", name: "orcid", value: getSingleAttributeMaybe(person, A.ORCID) },
            { "@type": "PropertyValue", name: "repositoryId", value: person.ref.toString() },
            { "@type": "PropertyValue", name: "studentId", value: getSingleAttributeMaybe(person, A.StudentId) }
        ],
        memberOf: getAffiliation(person),
        "@reverse": {
            author: repositoryItems
        }
    };
};

var getOutputAsSchemaDotOrg = function(item) {
    let published = O.serviceMaybe("hres:repository:earliest_publication_date", item);
    return {
        "@type": "CreativeWork",
        name: item.title,
        identifier: [
            { "@type": "PropertyValue", name: "doi", value: getSingleAttributeMaybe(item, A.DOI) },
            { "@type": "PropertyValue", name: "pubmedID", value: getSingleAttributeMaybe(item, A.PubmedID) },
            { "@type": "PropertyValue", name: "issn", value: getAttributes(item, A.ISSN) },
            { "@type": "PropertyValue", name: "respositoryId", value: item.ref.toString() }
        ],
        description: getSingleAttributeMaybe(item, A.Abstract),
        datePublished: published ? new XDate(published).toString("yyyy-MM-dd") : ""
    };
};

var getAffiliation = function(person) {
    // Only giving affiliations for internal people currently
    if(person.isKindOf(T.ExternalResearcher)) { return ""; }

    let isCurrent = (obj) => { return !!(person.isKindOf(T.Researcher) || person.isKindOf(T.Staff)); };
    
    let affiliation = {
        "@type": "OrganizationRole",
        roleName: getSingleAttributeMaybe(person, A.JobTitle)
    };
    let history = person.history || [];
    let firstVersion = history[0] || person;
    let start, end;
    if(firstVersion && isCurrent(firstVersion)) {
        // This is a bad proxy for the contract start date - but will get better the longer the system is 
        // installed at an institution!
        start = new XDate(person.creationDate).toString("yyyy-MM-dd");
        if(!isCurrent(person)) {
            // scan through the history until you find a version that is a current person, use the modification date
            // before that as the end date for the affiliation
            end = new XDate(person.lastModificationDate).toString("yyyy-MM-dd");
            for(var i = history.length-1; i >=0; --i) {
                let version = history[i];
                if(isCurrent(version)) { break; }
                end = new XDate(version.lastModificationDate).toString("yyyy-MM-dd");
            }
        }
    }
    affiliation.startDate = start || "";
    affiliation.endDate = end || "";
    affiliation.memberOf = {
        "@type": "EducationalOrganization",
        // Assumes repository is for a single institution
        name: O.query().link(T.University, A.Type).execute()[0].title
    };
    return affiliation;
};
