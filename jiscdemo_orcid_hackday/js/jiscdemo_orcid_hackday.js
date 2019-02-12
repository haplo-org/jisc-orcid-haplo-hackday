
P.respond("GET", "/api/demojisc-hackday/get-people-data", [
], function(E) {
    let people = [];

    let getAttributes = (o, d) => {
        return _.map(o.every(d), (v) => O.isRef(v) ? v.load().title : v.toString());
    };
    O.withoutPermissionEnforcement(() => {
        O.query().link(T.Person, A.Type).execute().each((object) => {
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
            people.push(data);
        });
    });
    E.response.body = JSON.stringify(people, undefined, 2);
    E.response.kind = 'text';
});

