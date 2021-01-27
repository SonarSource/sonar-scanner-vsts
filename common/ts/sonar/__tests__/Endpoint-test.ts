import Endpoint, { EndpointType } from "../Endpoint";

// VSTS-134
it("should not return null password", () => {
  const endpoint = new Endpoint(EndpointType.SonarQube, {
    url: "http://foo",
    token: undefined,
    username: "token123",
    password: undefined,
    organization: undefined,
  });
  expect(endpoint.auth).toEqual({ user: "token123" });
});
