#------------------------------------------------------------------------------
# Installs NodeJS, which is needed for building.
#
# Build from the basedir:
#   docker build -f cirrus/Dockerfile -t sonar-scanner-vsts-build cirrus
#
# Verify the content of the image by running a shell session in it:
#   docker run -it sonar-scanner-vsts-build
#
# CirrusCI builds the image when needed. No need to manually upload it to
# Google Cloud Container Registry. See section "gke_container" of .cirrus.yml
#------------------------------------------------------------------------------

FROM us.gcr.io/sonarqube-team/base:j11-latest

USER root

RUN curl -sL https://deb.nodesource.com/setup_10.x | bash -
RUN apt-get install -y nodejs

USER sonarsource
