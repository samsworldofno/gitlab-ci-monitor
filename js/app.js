var onError = function (error) {
  this.loading = false

  this.onError = { message: "Something went wrong. Make sure the configuration is ok and your Gitlab is up and running."}

  if(error.message == 'Network Error') {
    this.onError = { message: "Network Error. Please check the Gitlab domain." }
  }

  if(error.response.status == 401) {
    this.onError = { message: "Unauthorized Access. Please check your token." }
  }
}

var app = new Vue({
  el: '#app',
  data: {
    projects: [],
    builds: [],
    token: null,
    gitlab: null,
    repositories: null,
    loading: false,
    invalidConfig: false,
    onError: null
  },
  created: function() {
    this.loadConfig()

    if (!this.configValid()) {
      this.invalidConfig = true;
      return
    }

    this.setupDefaults()

    this.fetchProjecs()

    var self = this
    setInterval(function(){
      self.fetchBuilds()
    }, 60000)
  },
  methods: {
    loadConfig: function() {
      this.gitlab = getParameterByName("gitlab")
      this.token = getParameterByName("token")
      repositories = getParameterByName("projects")
      this.ref = getParameterByName("ref")
      if (repositories == null) {
        return
      }

      this.repositories = repositories.split(",")
    },
    configValid: function() {
      valid = true
      if (this.repositories == null || this.token == null || this.gitlab == null) {
        valid = false
      }

      return valid
    },
    setupDefaults: function() {
      axios.defaults.baseURL = "https://" + this.gitlab + "/api/v3"
      axios.defaults.headers.common['PRIVATE-TOKEN'] = this.token
    },
    fetchProjecs: function(page) {
      var self = this
      var page = page || 1

      self.loading = true
      axios.get('/projects?simple=true&per_page=100&page=' + page)
        .then(function (response) {
          self.loading = false

          response.data.forEach(function(p) {
            if (self.repositories.contains(p.name)) {
              self.projects.push(p)
            }
          })

          self.fetchBuilds()

          if(response.headers.link && response.headers.link.match('rel="next"')) {
            page++
            self.fetchProjecs(page)
          }
        })
        .catch(onError.bind(self));
    },
    fetchBuilds: function() {
      var self = this
      this.projects.forEach(function(p){
        axios.get('/projects/' + p.id + '/builds')
          .then(function (response) {
            updated = false

            build = self.filterLastBuild(response.data)
            if (!build) {
              return
            }
            startedFromNow = moment(build.started_at).fromNow()

            self.builds.forEach(function(b){
              if (b.project == p.name) {
                updated = true

                b.id = build.id
                b.status = build.status
                b.started_at = startedFromNow,
                b.author = build.commit.author_name
                b.project_path = p.path_with_namespace
              }
            });

            if (!updated) {
              self.builds.push({
                project: p.name,
                id: build.id,
                status: build.status,
                started_at: startedFromNow,
                author: build.commit.author_name,
                project_path: p.path_with_namespace
              })
            }
          })
          .catch(onError.bind(self));
      })
    },

    filterLastBuild: function(builds) {
      if (!Array.isArray(builds) || builds.length === 0) {
        return
      }

      if (this.ref) {
        var self = this
        return builds.find(function(build) {
          return build.ref === self.ref
        })
      } else {
        return builds[0]
      }
    }
  }
})
