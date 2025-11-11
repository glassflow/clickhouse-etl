@api
Feature: Filter Expression Validation

    Scenario: Validate a valid filter expression
        Given a running glassflow API server with local orchestrator
        When I send a POST request to "/api/v1/filter/validate" with body:
            """
            {
                "expression": "env == \"production\"",
                "fields": [
                    {
                        "field_name": "env",
                        "field_type": "string"
                    },
                    {
                        "field_name": "value",
                        "field_type": "int32"
                    }
                ]
            }
            """
        Then the response status should be 200

    Scenario: Reject invalid filter expression
        Given a running glassflow API server with local orchestrator
        When I send a POST request to "/api/v1/filter/validate" with body:
            """
            {
                "expression": "env == ",
                "fields": [
                    {
                        "field_name": "env",
                        "field_type": "string"
                    }
                ]
            }
            """
        Then the response status should be 400
