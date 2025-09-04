@platform
Feature: Platform Information

    Scenario: Get platform information for local orchestrator
        Given a running glassflow API server with local orchestrator
        When I send a GET request to "/api/v1/platform"
        Then the response status should be 200
        And the response should contain JSON:
            """
            {
                "orchestrator": "local"
            }
            """

    Scenario: Get platform information for k8s orchestrator
        Given a running glassflow API server with k8s orchestrator
        When I send a GET request to "/api/v1/platform"
        Then the response status should be 200
        And the response should contain JSON:
            """
            {
                "orchestrator": "k8s"
            }
            """

    Scenario: Platform endpoint returns correct content type
        Given a running glassflow API server with local orchestrator
        When I send a GET request to "/api/v1/platform"
        Then the response should have content type "application/json"
